package hls

import "errors"

// The size of the publisher's video is needed to choose the ladder (no point in encoding a 1080p
// rendition of a 480p source), and WebRTC does not report it. It is in the H.264 SPS the publisher sends
// ahead of its keyframes.

var errSPSTruncated = errors.New("truncated SPS")

// ExtractSPS returns the SPS NAL unit carried by an RTP H.264 payload: a single NAL unit (type 7) or one
// inside a STAP-A aggregate (type 24). It returns nil when the payload holds no SPS.
func ExtractSPS(payload []byte) []byte {
	if len(payload) < 1 {
		return nil
	}
	switch payload[0] & 0x1f {
	case 7:
		return payload
	case 24:
		offset := 1
		for offset+2 <= len(payload) {
			size := int(payload[offset])<<8 | int(payload[offset+1])
			offset += 2
			if size == 0 || offset+size > len(payload) {
				return nil
			}
			if payload[offset]&0x1f == 7 {
				return payload[offset : offset+size]
			}
			offset += size
		}
	}
	return nil
}

type bitReader struct {
	data []byte
	pos  int // in bits
	err  error
}

func (b *bitReader) bit() uint {
	if b.pos >= len(b.data)*8 {
		b.err = errSPSTruncated
		return 0
	}
	v := (b.data[b.pos/8] >> (7 - uint(b.pos%8))) & 1
	b.pos++
	return uint(v)
}

func (b *bitReader) bits(n int) uint {
	var v uint
	for i := 0; i < n; i++ {
		v = v<<1 | b.bit()
	}
	return v
}

// ue reads an unsigned Exp-Golomb code.
func (b *bitReader) ue() uint {
	zeros := 0
	for b.bit() == 0 {
		if b.err != nil || zeros > 31 {
			b.err = errSPSTruncated
			return 0
		}
		zeros++
	}
	return (1 << uint(zeros)) - 1 + b.bits(zeros)
}

// se reads a signed Exp-Golomb code.
func (b *bitReader) se() int {
	v := b.ue()
	if v%2 == 1 {
		return int((v + 1) / 2)
	}
	return -int(v / 2)
}

// unescape removes the emulation-prevention bytes (00 00 03 -> 00 00).
func unescape(nal []byte) []byte {
	out := make([]byte, 0, len(nal))
	zeros := 0
	for _, c := range nal {
		if zeros >= 2 && c == 3 {
			zeros = 0
			continue
		}
		if c == 0 {
			zeros++
		} else {
			zeros = 0
		}
		out = append(out, c)
	}
	return out
}

func skipScalingList(b *bitReader, size int) {
	last, next := 8, 8
	for j := 0; j < size; j++ {
		if next != 0 {
			next = (last + b.se() + 256) % 256
		}
		if next != 0 {
			last = next
		}
	}
}

// ParseSPSSize returns the displayed picture size (cropping applied) of an H.264 SPS NAL unit.
func ParseSPSSize(nal []byte) (width, height int, err error) {
	if len(nal) < 5 || nal[0]&0x1f != 7 {
		return 0, 0, errors.New("not an SPS")
	}
	b := &bitReader{data: unescape(nal[1:])}
	profile := b.bits(8)
	b.bits(8) // constraint flags + reserved
	b.bits(8) // level
	b.ue()    // sps id

	chroma := uint(1)
	switch profile {
	case 100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135:
		chroma = b.ue()
		if chroma == 3 {
			b.bit() // separate_colour_plane_flag
		}
		b.ue()            // bit depth luma
		b.ue()            // bit depth chroma
		b.bit()           // qpprime_y_zero_transform_bypass
		if b.bit() == 1 { // seq_scaling_matrix_present
			lists := 8
			if chroma == 3 {
				lists = 12
			}
			for i := 0; i < lists; i++ {
				if b.bit() == 1 {
					if i < 6 {
						skipScalingList(b, 16)
					} else {
						skipScalingList(b, 64)
					}
				}
			}
		}
	}

	b.ue()          // log2_max_frame_num_minus4
	switch b.ue() { // pic_order_cnt_type
	case 0:
		b.ue()
	case 1:
		b.bit()
		b.se()
		b.se()
		n := b.ue()
		for i := uint(0); i < n && b.err == nil; i++ {
			b.se()
		}
	}
	b.ue()  // max_num_ref_frames
	b.bit() // gaps_in_frame_num_value_allowed_flag

	widthMbs := b.ue() + 1
	heightMapUnits := b.ue() + 1
	frameMbsOnly := b.bit()
	if frameMbsOnly == 0 {
		b.bit() // mb_adaptive_frame_field_flag
	}
	b.bit() // direct_8x8_inference_flag

	var cropLeft, cropRight, cropTop, cropBottom uint
	if b.bit() == 1 { // frame_cropping_flag
		cropLeft, cropRight, cropTop, cropBottom = b.ue(), b.ue(), b.ue(), b.ue()
	}
	if b.err != nil {
		return 0, 0, b.err
	}

	cropUnitX, cropUnitY := uint(1), uint(2-frameMbsOnly)
	if chroma == 1 || chroma == 2 {
		cropUnitX = 2
	}
	if chroma == 1 {
		cropUnitY *= 2
	}
	w := int(widthMbs*16) - int(cropUnitX*(cropLeft+cropRight))
	h := int((2-frameMbsOnly)*heightMapUnits*16) - int(cropUnitY*(cropTop+cropBottom))
	if w < 64 || h < 64 || w > 16384 || h > 16384 { // no real video is smaller than 64x64
		return 0, 0, errors.New("implausible SPS size")
	}
	return w, h, nil
}
