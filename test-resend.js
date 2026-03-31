const emailKey = 're_i2ikDujd_MbRfTibJ4kfNBdk1WsZx7iuC';

async function trySend(from) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${emailKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: from,
      to: 'drafts+XsSnW2uNdPMs259cs4w5aDd5@maildrop.getdrafts.com',
      subject: 'Test draft from AI',
      text: 'Hello from test'
    })
  });
  const data = await res.json();
  console.log(`From ${from}:`, data);
}

(async () => {
  await trySend('capture@amesvt.com');
  await trySend('hello@ames.consulting');
  await trySend('capture@ames.consulting');
})();
