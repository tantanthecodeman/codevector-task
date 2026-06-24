
function encodeCursor({createdAt,id}){
  const payload= JSON.stringify({c:createdAt, i:id});
  return Buffer.from(payload, 'utf8').toString('base64');
}

function decodeCursor(cursorStr){
  try{
    const payload=Buffer.from(cursorStr, 'base64').toString('utf8');
    const {c,i}=JSON.parse(payload);
    if(!c || i===undefined || i===null){
      throw new Error('Malformed cursor payload');
    }
    return {createdAt: c, id: Number(i)};

  }catch(err){
    const e= new Error('invalid cursor');
    e.status=400;
    throw e;
  }
}

module.exports= {encodeCursor, decodeCursor};