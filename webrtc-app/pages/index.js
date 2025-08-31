import Head from 'next/head'
import VideoPlayer from '../components/VideoPlayer'

export default function Home() {
  return (
    <div>
      <Head>
        <title>WebRTC Multi-Stream Room Test</title>
        <meta name="description" content="WebRTC Multi-Stream Room Test" />
      </Head>

      <h1>WebRTC Multi-Stream Room Test</h1>
      <VideoPlayer />
    </div>
  )
}
