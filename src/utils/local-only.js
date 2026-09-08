// QR codes authorize a WhatsApp session. Never expose them through the hosted site.
export function localOnly(req, res, next) {
  const address = req.socket.remoteAddress;
  const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
  const host = req.get('host') || '';
  const validHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
  const origin = req.get('origin');
  const sameOrigin = !origin || origin === `http://${host}`;
  const fetchSite = req.get('sec-fetch-site');
  if (!loopback || !validHost || !sameOrigin || (fetchSite && !['same-origin', 'none'].includes(fetchSite))) {
    return res.status(403).json({ error: 'Autenticação disponível apenas no painel local.' });
  }
  next();
}
