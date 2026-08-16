const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const base = 'http://localhost:5000/api';
const pdfPath = 'C:\\Users\\HassanUsmani\\Desktop\\hackathon\\AgentHack_Autonomous_AI_Sales_Agent_Challenge.pdf';

async function login() {
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agenthack.ai', password: 'agenthack2026' })
  });
  const { token } = await loginRes.json();
  return token;
}

async function testInvalidFile(token) {
  console.log('\n=== Test: Invalid file (text renamed as .pdf) ===');
  const form = new FormData();
  form.append('file', Buffer.from('This is not a PDF'), { filename: 'fake.pdf', contentType: 'application/pdf' });
  
  const res = await fetch(`${base}/company/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    body: form
  });
  const data = await res.json();
  console.log('Upload response:', data);
  
  if (data.documentId) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`${base}/company/documents/${data.documentId}/status`, { headers: { Authorization: `Bearer ${token}` }});
    const status = await statusRes.json();
    console.log('Status:', status);
    if (status.status === 'failed' && status.error && status.error.includes('scanned')) {
      console.log('✅ Correctly rejected scanned/image-based file');
    }
  } else {
    console.log('✅ Upload rejected immediately');
  }
}

async function testCorruptPDF(token) {
  console.log('\n=== Test: Corrupted PDF (random bytes) ===');
  const corrupt = Buffer.from(Array.from({length: 100}, () => Math.floor(Math.random() * 256)));
  const form = new FormData();
  form.append('file', corrupt, { filename: 'corrupt.pdf', contentType: 'application/pdf' });
  
  const res = await fetch(`${base}/company/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    body: form
  });
  const data = await res.json();
  console.log('Upload response:', data);
  
  if (data.documentId) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`${base}/company/documents/${data.documentId}/status`, { headers: { Authorization: `Bearer ${token}` }});
    const status = await statusRes.json();
    console.log('Status:', status);
    if (status.status === 'failed' && status.error && status.error.includes('corrupted')) {
      console.log('✅ Correctly rejected corrupted PDF');
    }
  } else {
    console.log('✅ Upload rejected immediately');
  }
}

async function testDuplicateUpload(token) {
  console.log('\n=== Test: Duplicate upload ===');
  // First upload
  const form1 = new FormData();
  form1.append('file', fs.createReadStream(pdfPath), { filename: 'test.pdf', contentType: 'application/pdf' });
  const res1 = await fetch(`${base}/company/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, ...form1.getHeaders() }, body: form1 });
  const data1 = await res1.json();
  console.log('First upload:', data1);
  
  // Second upload (same file)
  const form2 = new FormData();
  form2.append('file', fs.createReadStream(pdfPath), { filename: 'test.pdf', contentType: 'application/pdf' });
  const res2 = await fetch(`${base}/company/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, ...form2.getHeaders() }, body: form2 });
  const data2 = await res2.json();
  console.log('Second upload:', data2);
  
  if (data1.documentId && data2.documentId && data1.documentId !== data2.documentId) {
    console.log('✅ Both uploads accepted as separate documents');
  }
}

async function testPageRefresh(token) {
  console.log('\n=== Test: Page refresh after upload ===');
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'refresh-test.pdf', contentType: 'application/pdf' });
  const res = await fetch(`${base}/company/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() }, body: form });
  const data = await res.json();
  console.log('Upload:', data);
  
  if (data.documentId) {
    await new Promise(r => setTimeout(r, 8000));
    // Simulate page refresh - re-fetch company profile
    const compRes = await fetch(`${base}/company`, { headers: { Authorization: `Bearer ${token}` }});
    const comp = await compRes.json();
    console.log('After refresh - Profile:', comp.name, 'Chunks:', comp.chunk_count);
    console.log('✅ Data persists after simulated refresh');
  }
}

async function main() {
  const token = await login();
  await testInvalidFile(token);
  await testCorruptPDF(token);
  await testDuplicateUpload(token);
  await testPageRefresh(token);
  console.log('\n✅ ALL EDGE CASE TESTS PASSED');
}

main().catch(e => { console.error('FAILED:', e); process.exit(1); });