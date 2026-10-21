//go:build linux

package hls

import (
	"os/exec"
	"runtime"
	"syscall"
)

// setProcAttr makes the kernel kill FFmpeg if the backend dies, so no orphan keeps encoding.
func setProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGKILL}
}

// Pdeathsig fires when the OS *thread* that started the child exits, not the process. Every FFmpeg is
// therefore started from one goroutine pinned to its own thread for the life of the program.
// ffmpegNice is FFmpeg's niceness: lower priority than the SFU's goroutines.
const ffmpegNice = 10

type spawnJob struct {
	cmd *exec.Cmd
	res chan error
}

var spawnJobs = make(chan spawnJob)

func init() {
	go func() {
		runtime.LockOSThread() // never unlocked on purpose
		for job := range spawnJobs {
			err := job.cmd.Start()
			if err == nil {
				// Encoding must never starve the API and the media server it shares the machine with.
				_ = syscall.Setpriority(syscall.PRIO_PROCESS, job.cmd.Process.Pid, ffmpegNice)
			}
			job.res <- err
		}
	}()
}

func startCommand(cmd *exec.Cmd) error {
	res := make(chan error, 1)
	spawnJobs <- spawnJob{cmd: cmd, res: res}
	return <-res
}
