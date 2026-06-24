
function encodeCursor({createdAt,id}){
  const payload= JSON.stringify({c:createdAt, i:id});
  return Buffer.from(payload, 'utf8').toString('base64');
}

