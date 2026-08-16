const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const base = 'http://localhost:5000/api';
const pdfPath = 'C:\\Users\\HassanUsmani\\Desktop\\hackathon\\AgentHack_Autonomous_AI_Sales_Agent_Challenge.pdf';

async function test() {
  const loginRes = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@agenthack.ai', password: 'agenthack2026' }) });
  const { token } = await loginRes.json();
  
  // Fresh upload
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'fresh-test.pdf', contentType: 'application/pdf' });
  const uploadRes = await fetch(base + '/company/documents/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token, ...form.getHeaders() }, body: form });
  const upload = await uploadRes.json();
  console.log('Upload:', upload);
  
  if (upload.documentId) {
    // Wait for indexing
    for (let i = 0; i < 30; i++) {
      const s = await fetch(base + '/company/documents/' + upload.documentId + '/status', { headers: { Authorization: 'Bearer ' + token }});
      const status = await s.json();
      if (status.status === 'indexed') { console.log('Indexed:', status); break; }
      if (status.status === 'failed') { console.log('Failed:', status); break; }
      await new Promise(r => setTimeout(r, 1500));
    }
    
    // Check page_text format
    const docRes = await fetch(base + '/company/documents/' + upload.documentId, { headers: { Authorization: 'Bearer ' + token }});
    const doc = await docRes.json();
    console.log('page_text type:', typeof doc.page_text, Array.isArray(doc.page_text) ? 'array' : 'string');
    console.log('page_text preview:', JSON.stringify(doc.page_text).substring(0, 100));
    
    // Reprocess
    const rp = await fetch(base + '/company/documents/' + upload.documentId + '/reprocess', { method: 'POST', headers: { Authorization: 'Bearer ' + token }});
    const reproc = await rp.json();
    console.log('Reprocess:', reproc);
  }
}
test().catch(e => console.error(e));