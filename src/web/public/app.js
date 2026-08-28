async function refresh() {
  const res = await fetch('/api/infos');
  const nodes = await res.json();
  const grid = document.getElementById('grid');
  grid.innerHTML = nodes.map(renderCard).join('');
  document.getElementById('updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
}

function renderCard(n) {
  const status = n.online
    ? `<span class="badge online">online</span>`
    : `<span class="badge offline">offline</span>`;
  const role = n.isValidator ? 'validator (Clique signer)' : 'full node';
  if (!n.online) {
    return `<div class="card">
      <h2>${n.label} ${status}</h2>
      <div class="role">${n.client} · ${role}</div>
      <div class="row"><span>Address</span><span class="addr">${n.address}</span></div>
    </div>`;
  }
  return `<div class="card">
    <h2>${n.label} ${status}</h2>
    <div class="role">${n.client} · ${role}</div>
    <div class="row"><span>Latest block</span><span>${n.blockNumber}</span></div>
    <div class="row"><span>Peers</span><span>${n.peerCount}</span></div>
    <div class="row"><span>Mempool</span><span>${n.mempool}</span></div>
    <div class="row"><span>CPU</span><span>${n.cpu ?? '-'}</span></div>
    <div class="row"><span>Memory</span><span>${n.mem ?? '-'}</span></div>
    <div class="row"><span>Balance</span><span>${n.balance} ETH</span></div>
    <div class="row"><span>Address</span><span class="addr">${n.address}</span></div>
  </div>`;
}

refresh();
setInterval(refresh, 3000);
