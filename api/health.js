module.exports = async (req, res) => {
  res.status(200).json({ ok: true, service: 'Pragathi Infotech API', time: new Date().toISOString() });
};
