const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS });
    }

    try {
      const data = await request.json();
      const { email, content, tags, syntax, flagged, latitude, longitude } = data;
      
      if (!email || !content) {
        return new Response(JSON.stringify({ error: 'Missing email or content' }), { 
          status: 400, 
          headers: { ...CORS, 'Content-Type': 'application/json' } 
        });
      }

      const lines = content.trim().split('\n');
      let subject = lines[0].substring(0, 150);
      let body = lines.slice(1).join('\n');
      
      if (tags) {
        const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
        if (tagArray.length > 0) {
            const tagStr = tagArray.map(t => '#' + t.replace(/\s+/g, '')).join(' ');
            subject = subject + ' ' + tagStr;
        }
      }

      // Drafts Mail Drop doesn't natively parse syntax, flags, or location, 
      // but we append them to the body so they aren't lost (actions can parse them).
      const meta = [];
      if (syntax && syntax !== 'Plain Text') meta.push(`Syntax: ${syntax}`);
      if (flagged) meta.push(`Flagged: yes`);
      if (latitude && longitude) meta.push(`Location: ${latitude}, ${longitude}`);

      if (meta.length > 0) {
          body += '\n\n---\n' + meta.join('\n');
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Capture <capture@drafts.amesvt.com>',
          to: email,
          subject: subject,
          text: body || ' '
        })
      });

      const resData = await res.text();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Resend API Error: ${resData}` }), { 
          status: 502, 
          headers: { ...CORS, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { ...CORS, 'Content-Type': 'application/json' } 
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...CORS, 'Content-Type': 'application/json' } 
      });
    }
  }
};
