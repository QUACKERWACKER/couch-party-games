// The room relay exchanges offers. ICE uses host candidates only, with no TURN relay.
export function localPeer() {
  if (typeof RTCPeerConnection !== 'function') return null;
  try {
    return new RTCPeerConnection({iceServers: []});
  } catch {
    return null;
  }
}

export async function localDescription(peer, description) {
  await peer.setLocalDescription(description);
  if (peer.iceGatheringState !== 'complete') {
    await new Promise(resolve => {
      const timer = setTimeout(done, 1200);
      function done() {
        clearTimeout(timer);
        peer.removeEventListener('icegatheringstatechange', changed);
        resolve();
      }
      function changed() {
        if (peer.iceGatheringState === 'complete') done();
      }
      peer.addEventListener('icegatheringstatechange', changed);
    });
  }
  return peer.localDescription?.sdp;
}
