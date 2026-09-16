const b=require('../lib/booking');
function validate(body){
  const {date,time,name,phone,email,requestId}=body;
  if(typeof name!=='string'||name.trim().length<3||name.length>120||/[\x00-\x1f<>]/.test(name))throw new b.BookingError(400,'Informe seu nome completo.');
  if(typeof phone!=='string'||!/^[\d\s()+-]{10,24}$/.test(phone)||phone.replace(/\D/g,'').length<10)throw new b.BookingError(400,'Informe um telefone válido.');
  if(typeof email!=='string'||email.length>254||! /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))throw new b.BookingError(400,'Informe um e-mail válido.');
  if(typeof requestId!=='string'||!/^[a-f0-9-]{36}$/.test(requestId))throw new b.BookingError(400,'Reabra o formulário e tente novamente.');
  const slot=b.dateSlots(String(date)).find(s=>s.time===time);if(!slot||!slot.future)throw new b.BookingError(409,'Esse horário não está disponível. Escolha outro.');
  return {date,time,name:name.trim(),phone:phone.trim(),email:email.trim().toLowerCase(),requestId,slot};
}
module.exports=async(req,res)=>{try{
  if(req.method!=='POST')throw new b.BookingError(405,'Método não permitido.');b.sameOrigin(req);b.requireConfig();await b.rateLimit(req,'book',12);
  const input=validate(b.parseBody(req));const {date,time,slot}=input,key=b.reservationKey(date,time),eventId=b.hash(`ocr:${input.requestId}`),fingerprint=b.hash(JSON.stringify([date,time,input.name,input.phone,input.email,input.requestId]));const token=await b.accessToken();
  const previous=await b.redis('GET',key);
  if(previous){const record=JSON.parse(previous);if(record.fingerprint!==fingerprint)throw new b.BookingError(409,'Esse horário acabou de ser reservado. Escolha outro.');const check=await b.calendar(`calendars/${encodeURIComponent(b.OWNER)}/events/${record.eventId}`,token);if(check.response.ok&&check.data.status!=='cancelled'){b.json(res,200,{confirmed:true,date,time,reference:record.eventId});return;}throw new b.BookingError(503,'Sua confirmação ainda está sendo verificada. Tente novamente com os mesmos dados ou fale pelo WhatsApp.');}
  const busy=await b.busyForDate(date,token);if(b.overlaps(slot,busy))throw new b.BookingError(409,'Esse horário acabou de ser ocupado. Escolha outro.');
  // Slots are a fixed, non-overlapping 90-minute timetable. NX makes one
  // reservation per slot atomic across all server instances. An uncertain
  // Google response retains the reservation until reconciled by event ID.
  const record=JSON.stringify({fingerprint,eventId,createdAt:new Date().toISOString()});if(!(await b.redis('SET',key,record,'NX','EX',100*86400)))throw new b.BookingError(409,'Esse horário acabou de ser reservado. Escolha outro.');
  const release=()=>b.redis('EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",1,key,record);
  // Recheck external Calendar edits after acquiring the slot.
  try{if(b.overlaps(slot,await b.busyForDate(date,token))){await release();throw new b.BookingError(409,'Esse horário acabou de ser ocupado. Escolha outro.');}}catch(error){await release();throw error;}
  const result=await b.calendar(`calendars/${encodeURIComponent(b.OWNER)}/events?sendUpdates=all`,token,{method:'POST',body:JSON.stringify({id:eventId,summary:`Análise Corporal — ${input.name}`,description:`Agendamento pelo site O Corpo Responde.\nNome: ${input.name}\nTelefone: ${input.phone}\nE-mail: ${input.email}`,start:{dateTime:slot.start,timeZone:b.ZONE},end:{dateTime:slot.end,timeZone:b.ZONE},attendees:[{email:input.email}],visibility:'private',transparency:'opaque',guestsCanModify:false,guestsCanInviteOthers:false,extendedProperties:{private:{source:'ocorporesponde',reservation:input.requestId}}})});
  if(!result.response.ok){if([400,401,403,404].includes(result.response.status))await release();throw new b.BookingError(503,'Não foi possível confirmar o agendamento. Tente novamente com os mesmos dados ou fale pelo WhatsApp.');}
  b.json(res,201,{confirmed:true,date,time,reference:eventId});
}catch(error){b.fail(res,error)}};
module.exports.validate=validate;
