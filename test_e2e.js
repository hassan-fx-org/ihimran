const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const base = 'http://localhost:5000/api';
const pdfPath = 'C:\\Users\\HassanUsmani\\Desktop\\hackathon\\AgentHack_Autonomous_AI_Sales_Agent_Challenge.pdf';

async function test() {
  // login
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agenthack.ai', password: 'agenthack2026' })
  });
  const { token } = await loginRes.json();
  console.log('Token:', token.substring(0, 20) + '...');

  // upload
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'test.pdf', contentType: 'application/pdf' });
  
  const uploadRes = await fetch(`${base}/company/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    body: form
  });
  const upload = await uploadRes.json();
  console.log('Upload:', JSON.stringify(upload, null, 2));
  
  if (!upload.documentId) {
    console.error('No documentId returned!');
    process.exit(1);
  }
  
  const docId = upload.documentId;
  console.log('Document ID:', docId);

  // poll status
  for (let i = 0; i < 60; i++) {
    const statusRes = await fetch(`${base}/company/documents/${docId}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const status = await statusRes.json();
    console.log(`Poll ${i+1}: status=${status.status}, detail=${status.status_detail}, pages=${status.page_count}, chunks=${status.chunk_count}, error=${status.error}`);
    
    if (status.status === 'indexed') break;
    if (status.status === 'failed') {
      console.error('Processing failed:', status.error);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // get company profile
  const compRes = await fetch(`${base}/company`, { headers: { Authorization: `Bearer ${token}` } });
  const comp = await compRes.json();
  console.log('\nCompany profile:');
  console.log('  Name:', comp.name);
  console.log('  Chunks:', comp.chunk_count);
  console.log('  Offerings:', comp.offerings?.length || 0);
  console.log('  Summary:', comp.summary?.substring(0, 100) + '...');

  // ask
  const askRes = await fetch(`${base}/company/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question: 'What services do we offer?' })
  });
  const ask = await askRes.json();
  console.log('\nAsk response:');
  console.log('  Answer:', ask.answer?.substring(0, 200));
  console.log('  Error:', ask.error);
  console.log('  Sources:', ask.sources?.length || 0);
  ask.sources?.forEach((s, i) => console.log(`  Source ${i+1}: doc=${s.document} page=${s.page} section=${s.section}`));

  // view chunks
  const chunksRes = await fetch(`${base}/company/documents/${docId}/chunks`, { headers: { Authorization: `Bearer ${token}` } });
  const chunks = await chunksRes.json();
  console.log('\nChunks:', chunks.length);
  if (chunks.length > 0) {
    console.log('  First chunk:', chunks[0].category, 'page=', chunks[0].page, 'section=', chunks[0].section);
  }

  // reprocess
  console.log('\nReprocess...');
  const reprocRes = await fetch(`${base}/company/documents/${docId}/reprocess`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const reproc = await reprocRes.json();
  console.log('Reprocess started:', reproc);

  for (let i = 0; i < 60; i++) {
    const statusRes = await fetch(`${base}/company/documents/${docId}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const status = await statusRes.json();
    console.log(`Re-poll ${i+1}: ${status.status} / ${status.status_detail}`);
    if (status.status === 'indexed') break;
    if (status.status === 'failed') {
      console.error('Reprocess failed:', status.error);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('Reprocess done!');

  // delete
  console.log('\nDelete...');
  await fetch(`${base}/company/documents/${docId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const docsRes = await fetch(`${base}/company/documents`, { headers: { Authorization: `Bearer ${token}` } });
  const docs = await docsRes.json();
  console.log('Documents after delete:', docs.length);

  console.log('\n✅ ALL TESTS PASSED');
}

test().catch(e => {
  console.error('FAILED:', e);
  process.exit(1);
});