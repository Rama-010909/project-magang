import {put} from '@vercel/blob';
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const type=req.headers['content-type']||'application/octet-stream';
    const ext=type.split('/')[1]||'bin';
    const blob=await put(`assets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,req, {access:'public',contentType:type});
    return res.status(200).json({url:blob.url});
  }catch(e){return res.status(500).json({error:e.message})}
}