import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'templates.json');

const ensureData = () => {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const readTemplates = () => {
  try {
    ensureData();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
    }
    return {};
  } catch (e) {
    console.error('readTemplates error', e);
    return {};
  }
};

const writeTemplates = (data) => {
  try {
    ensureData();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('writeTemplates error', e);
    return false;
  }
};

export default function handler(req, res) {
  const { method } = req;
  if (method === 'GET') {
    const data = readTemplates();
    res.status(200).json({ success: true, data });
    return;
  }

  if (method === 'POST') {
    try {
      const { key, template } = req.body;
      if (!key || !template) return res.status(400).json({ success: false, error: 'Missing key or template' });
      const current = readTemplates();
      current[key] = template;
      if (writeTemplates(current)) return res.status(201).json({ success: true, data: current });
      return res.status(500).json({ success: false, error: 'Failed to save template' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  }

  if (method === 'DELETE') {
    try {
      const { key } = req.body;
      if (!key) return res.status(400).json({ success: false, error: 'Missing key' });
      const current = readTemplates();
      if (!current[key]) return res.status(404).json({ success: false, error: 'Template not found' });
      delete current[key];
      if (writeTemplates(current)) return res.status(200).json({ success: true, data: current });
      return res.status(500).json({ success: false, error: 'Failed to delete template' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  }

  res.setHeader('Allow', ['GET','POST','DELETE']);
  res.status(405).end('Method Not Allowed');
}