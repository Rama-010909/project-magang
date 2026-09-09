import diskominfoLogo from './assets/diskominfo-batang.jpg';
import pemkabLogo from './assets/pemkab-batang-official.png';
import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QRCodeSVG} from 'qrcode.react';
import {collection,addDoc,deleteDoc,doc,onSnapshot,serverTimestamp,query,orderBy,updateDoc} from 'firebase/firestore';
import {db} from './firebase';
import './style.css';

const cats=['PC / Laptop','Router','Switch','Access Point','CCTV','NVR / DVR','Printer','Server','UPS','Monitor','Lainnya'];
const statuses=['Aktif','Maintenance','Rusak','Tidak Digunakan'];
const empty={kodeAset:'',nama:'',kategori:'PC / Laptop',merk:'',model:'',serialNumber:'',ipAddress:'',macAddress:'',lokasi:'',kondisi:'Baik',status:'Aktif',keterangan:'',fotoUrl:''};

function App(){
 const [assets,setAssets]=useState([]),[maint,setMaint]=useState([]),[page,setPage]=useState('dashboard');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('Semua'),[form,setForm]=useState(empty),[editing,setEditing]=useState(null);
 const [selected,setSelected]=useState(null),[login,setLogin]=useState(false),[username,setUsername]=useState(''),[pass,setPass]=useState('');
 const [showPass,setShowPass]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [toast,setToast]=useState('');

 useEffect(()=>{const unsub=onSnapshot(query(collection(db,'assets'),orderBy('createdAt','desc')),s=>{setAssets(s.docs.map(d=>({id:d.id,...d.data()})));setError('')},e=>setError('Gagal memuat aset: '+e.message));return unsub},[]);
 useEffect(()=>{const unsub=onSnapshot(query(collection(db,'maintenance'),orderBy('tanggal','desc')),s=>setMaint(s.docs.map(d=>({id:d.id,...d.data()}))),e=>setError('Gagal memuat maintenance: '+e.message));return unsub},[]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),2800);return()=>clearTimeout(t)}},[toast]);
 useEffect(()=>{const match=location.hash.match(/^#asset=(.+)$/);if(match){const a=assets.find(x=>x.id===match[1]);if(a)setSelected(a)}},[assets]);
 const counts=useMemo(()=>({total:assets.length,aktif:assets.filter(x=>x.status==='Aktif').length,maint:assets.filter(x=>x.status==='Maintenance').length,rusak:assets.filter(x=>x.status==='Rusak').length,idle:assets.filter(x=>x.status==='Tidak Digunakan').length}),[assets]);
 const visible=assets.filter(x=>(filter==='Semua'||x.status===filter)&&Object.values(x).join(' ').toLowerCase().includes(search.toLowerCase()));

 function go(p){setPage(p);setSelected(null);window.scrollTo({top:0,behavior:'smooth'})}
 function openAdd(){setForm({...empty,kodeAset:'AST-'+String(Date.now()).slice(-6)});setEditing(null);go('form')}
 function openEdit(a){setForm({...empty,...a});setEditing(a.id);go('form')}
 async function save(e){e.preventDefault();setLoading(true);try{
   const payload={...form,updatedAt:serverTimestamp()};
   if(editing) await updateDoc(doc(db,'assets',editing),payload);
   else await addDoc(collection(db,'assets'),{...payload,createdAt:serverTimestamp()});
   setToast(editing?'Perubahan aset berhasil disimpan':'Perangkat berhasil ditambahkan');setForm(empty);setEditing(null);go('inventaris');
 }catch(err){alert('Gagal menyimpan aset: '+err.message)}finally{setLoading(false)}}
 async function remove(id){if(!confirm('Hapus perangkat ini? Data yang dihapus tidak dapat dikembalikan.'))return;try{await deleteDoc(doc(db,'assets',id));setToast('Aset berhasil dihapus')}catch(e){alert('Gagal menghapus: '+e.message)}}
 async function addMaintenance(e){e.preventDefault();if(!selected)return;const f=new FormData(e.currentTarget);try{
   await addDoc(collection(db,'maintenance'),{assetId:selected.id,tanggal:f.get('tanggal'),teknisi:f.get('teknisi'),keluhan:f.get('keluhan'),tindakan:f.get('tindakan'),hasil:f.get('hasil'),createdAt:serverTimestamp()});
   e.currentTarget.reset();setToast('Riwayat maintenance berhasil disimpan');
 }catch(e){alert('Gagal menyimpan maintenance: '+e.message)}}
 async function removeMaintenance(id){if(!confirm('Hapus riwayat maintenance ini?'))return;try{await deleteDoc(doc(db,'maintenance',id));setToast('Riwayat berhasil dihapus')}catch(e){alert('Gagal menghapus riwayat: '+e.message)}}

 if(!login)return <Login username={username} pass={pass} setUsername={setUsername} setPass={setPass} showPass={showPass} setShowPass={setShowPass} enter={()=>{if(username==='admin'&&pass==='kominfobatang'){setLogin(true);setUsername('');setPass('')}else alert('Username atau password salah')}}/>;

 return <div className="app">
  <aside>
   <div className="brand">
    <div className="brandmarks"><img className="brandlogo pemkab" src={pemkabLogo} alt="Pemerintah Kabupaten Batang"/><img className="brandlogo diskominfo" src={diskominfoLogo} alt="Diskominfo Kabupaten Batang"/></div>
    <div><b>IT Asset</b><span>Diskominfo Batang</span></div>
   </div>
   <nav>{[['dashboard','⌂','Dashboard'],['inventaris','▦','Inventaris'],['maintenance','↻','Maintenance'],['laporan','▤','Laporan']].map(([p,ic,label])=><button className={page===p?'nav active':'nav'} onClick={()=>go(p)} key={p}><i>{ic}</i><span>{label}</span></button>)}</nav>
   <button className="nav logout" onClick={()=>setLogin(false)}><i>↪</i><span>Keluar</span></button>
  </aside>
  <div className="mobileNav">{[['dashboard','⌂','Beranda'],['inventaris','▦','Aset'],['maintenance','↻','Servis'],['laporan','▤','Laporan']].map(([p,ic,label])=><button className={page===p?'active':''} onClick={()=>go(p)} key={p}><i>{ic}</i><span>{label}</span></button>)}</div>
  <main>
   <header><div><div className="crumb">DISKOMINFO KABUPATEN BATANG</div><h1>{page==='dashboard'?'Dashboard':page==='inventaris'?'Inventaris':page==='maintenance'?'Maintenance':page==='laporan'?'Laporan':'Tambah Perangkat'}</h1><p>Kelola perangkat dan aset teknologi informasi secara rapi dan terkontrol.</p></div><button className="primary addBtn" onClick={openAdd}><b>＋</b><span>Tambah Perangkat</span></button></header>
   {error&&<div className="errorbar">⚠ {error}</div>}
   {page==='dashboard'&&<Dashboard counts={counts} assets={assets} setSelected={a=>{setSelected(a);location.hash='asset='+a.id}} go={go}/>}
   {page==='inventaris'&&<><div className="toolbar"><div className="searchbox">⌕<input placeholder="Cari kode, nama, lokasi, IP, merk..." value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>Semua</option>{statuses.map(s=><option key={s}>{s}</option>)}</select><span className="resultcount">{visible.length} aset</span></div><div className="grid">{visible.map(a=><AssetCard key={a.id} a={a} onEdit={()=>openEdit(a)} onDelete={()=>remove(a.id)} onOpen={()=>{setSelected(a);location.hash='asset='+a.id}}/>)}{!visible.length&&<div className="empty">Belum ada perangkat yang sesuai.</div>}</div></>}
   {page==='form'&&<AssetForm form={form} setForm={setForm} save={save} loading={loading} editing={editing} cancel={()=>go('inventaris')}/>}
   {page==='maintenance'&&<Maintenance assets={assets} maint={maint} selected={selected} setSelected={setSelected} addMaintenance={addMaintenance} removeMaintenance={removeMaintenance}/>}
   {page==='laporan'&&<Reports assets={assets} counts={counts}/>}
   {selected&&<Detail a={selected} maint={maint.filter(m=>m.assetId===selected.id)} close={()=>{setSelected(null);if(location.hash)history.replaceState(null,'',location.pathname+location.search)}} addMaintenance={addMaintenance}/>}
  </main>
  {toast&&<div className="toast">✓ <span>{toast}</span></div>}
 </div>
}

function EyeIcon({open}){return open?<svg viewBox="0 0 24 24"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>:<svg viewBox="0 0 24 24"><path d="m3 3 18 18"/><path d="M10.6 6.2C11.05 6.07 11.52 6 12 6c6.1 0 9.5 6 9.5 6a16.8 16.8 0 0 1-3.1 3.7"/><path d="M6.2 6.9C3.8 8.3 2.5 12 2.5 12s3.4 6 9.5 6c1.15 0 2.2-.2 3.15-.52"/><path d="M9.9 9.9a2.7 2.7 0 0 0 3.8 3.8"/></svg>}

function Login(p){return <div className="login"><div className="loginGlow one"/><div className="loginGlow two"/><div className="loginbox">
 <div className="officialMarks"><img className="pemkabFull" src={pemkabLogo} alt="Pemerintah Kabupaten Batang"/><img className="diskominfoFull" src={diskominfoLogo} alt="Diskominfo Kabupaten Batang"/></div>
 <div className="loginLine"/>
 <div className="loginbadge">SISTEM INFORMASI ASET IT</div><h1>IT Asset Management</h1><p>Diskominfo Kabupaten Batang</p>
 <label className="loginlabel">Username<input placeholder="Masukkan username" autoComplete="username" value={p.username} onChange={e=>p.setUsername(e.target.value)}/></label>
 <label className="loginlabel">Password<div className="password"><input type={p.showPass?'text':'password'} placeholder="Masukkan password" autoComplete="current-password" value={p.pass} onChange={e=>p.setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&p.enter()}/><button type="button" aria-label={p.showPass?'Sembunyikan password':'Tampilkan password'} title={p.showPass?'Sembunyikan password':'Tampilkan password'} onClick={()=>p.setShowPass(!p.showPass)}><EyeIcon open={p.showPass}/></button></div></label>
 <button className="primary full" onClick={p.enter}>Masuk ke Sistem <span>→</span></button>
 <small>Portal internal pengelolaan aset teknologi informasi<br/>© 2026 Diskominfo Kabupaten Batang</small>
 </div></div>}

function Dashboard({counts,assets,setSelected,go}){const pct=n=>counts.total?Math.round(n/counts.total*100):0;return <div className="dashboard">
 <section className="welcome"><div className="welcomeText"><div className="eyebrow">PORTAL INTERNAL • DISKOMINFO KABUPATEN BATANG</div><h2>Selamat datang di <b>IT Asset Management</b></h2><p>Pusat pengelolaan perangkat teknologi informasi untuk membantu pencatatan, pemantauan, maintenance, dan pelaporan aset secara lebih tertib.</p><div className="quick"><button className="primary" onClick={()=>go('inventaris')}>Lihat Inventaris <span>→</span></button><button className="soft" onClick={()=>go('laporan')}>Buka Laporan</button></div></div><div className="govmarks"><img className="pemkabWide" src={pemkabLogo} alt="Pemerintah Kabupaten Batang"/><img className="diskominfoWide" src={diskominfoLogo} alt="Diskominfo Kabupaten Batang"/></div></section>
 <div className="stats">{[['Total Perangkat',counts.total,'asset','▦'],['Aktif',counts.aktif,'active','✓'],['Maintenance',counts.maint,'maint','↻'],['Rusak',counts.rusak,'broken','!']].map(x=><div className={'stat '+x[2]} key={x[0]}><div className="statIcon">{x[3]}</div><div><span>{x[0]}</span><strong>{x[1]}</strong></div><small>{pct(x[1])}% dari aset</small></div>)}</div>
 <div className="dashgrid"><section className="panel chartpanel"><div className="panelhead"><div><h2>Status Aset</h2><p className="muted">Ringkasan perangkat saat ini</p></div><button onClick={()=>go('inventaris')}>Kelola →</button></div><div className="bars">{[['Aktif',counts.aktif,'active'],['Maintenance',counts.maint,'maint'],['Rusak',counts.rusak,'broken'],['Tidak Digunakan',counts.idle,'idle']].map(x=><div className="barrow" key={x[0]}><div><span>{x[0]}</span><b>{x[1]}</b></div><div className="bar"><i className={x[2]} style={{width:(counts.total?Math.max(x[1]?6:0,x[1]/counts.total*100):0)+'%'}}/></div></div>)}</div></section>
 <section className="panel latest"><div className="panelhead"><div><h2>Perangkat Terbaru</h2><p className="muted">Aset yang baru masuk ke sistem</p></div><button onClick={()=>go('inventaris')}>Lihat semua →</button></div>{assets.slice(0,5).map(a=><div className="row" key={a.id} onClick={()=>setSelected(a)}><div className="thumb">{a.fotoUrl?<img src={a.fotoUrl} alt=""/>:a.kategori?.slice(0,2)}</div><div><b>{a.nama}</b><span>{a.kodeAset} · {a.lokasi||'Lokasi belum diisi'}</span></div><Status s={a.status}/></div>)}{!assets.length&&<div className="empty">Belum ada perangkat.</div>}</section></div>
 <div className="infoStrip"><div><span>Tips pengelolaan aset</span><b>Pastikan setiap perangkat memiliki kode aset, lokasi, dan status yang jelas.</b></div><button className="soft" onClick={()=>go('maintenance')}>Cek Maintenance →</button></div>
 </div>}

function Status({s}){return <span className={'status '+(s||'').toLowerCase().replaceAll(' ','-')}>{s||'-'}</span>}
function AssetCard({a,onEdit,onDelete,onOpen}){return <div className="card"><div className="photo">{a.fotoUrl?<img src={a.fotoUrl} alt={a.nama||'Foto perangkat'}/>:<span>{a.kategori?.slice(0,3)}</span>}</div><div className="cardbody"><div className="between"><b>{a.nama||'Tanpa nama'}</b><Status s={a.status}/></div><span className="muted">{a.kodeAset} · {a.kategori}</span><p>{a.lokasi||'Lokasi belum diisi'}</p><div className="actions"><button onClick={onOpen}>Detail</button><button onClick={onEdit}>Edit</button><button className="danger" onClick={onDelete}>Hapus</button></div></div></div>}

function AssetForm({form,setForm,save,loading,editing,cancel}){const [upload,setUpload]=useState(false);async function uploadPhoto(e){const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024){alert('Ukuran foto maksimal 5 MB.');return}setUpload(true);try{const r=await fetch('/api/upload',{method:'POST',headers:{'content-type':file.type},body:file});if(!r.ok)throw Error('Upload foto gagal. Pastikan Vercel Blob sudah dikonfigurasi.');const d=await r.json();setForm({...form,fotoUrl:d.url})}catch(e){alert(e.message)}finally{setUpload(false)}}return <form className="form panel" onSubmit={save}><div className="formTitle"><div><div className="eyebrow">DATA PERANGKAT</div><h2>{editing?'Edit Perangkat':'Tambah Perangkat'}</h2></div><span className="formhint">* wajib diisi</span></div><div className="formgrid">
 {Object.entries({kodeAset:'Kode Aset',nama:'Nama Perangkat',merk:'Merk',model:'Model',serialNumber:'Serial Number',ipAddress:'IP Address',macAddress:'MAC Address',lokasi:'Lokasi'}).map(([k,l])=><label key={k}>{l}{['kodeAset','nama'].includes(k)&&<em>*</em>}<input required={['kodeAset','nama'].includes(k)} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}
 <label>Kategori<select value={form.kategori} onChange={e=>setForm({...form,kategori:e.target.value})}>{cats.map(c=><option key={c}>{c}</option>)}</select></label><label>Kondisi<select value={form.kondisi} onChange={e=>setForm({...form,kondisi:e.target.value})}><option>Baik</option><option>Cukup</option><option>Rusak</option></select></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
 <label className="wide">Foto Perangkat<input type="file" accept="image/*" onChange={uploadPhoto}/>{upload&&<small>Mengunggah foto...</small>}{form.fotoUrl&&<img className="preview" src={form.fotoUrl} alt="Preview perangkat"/>}</label>
 <label className="wide">Keterangan<textarea value={form.keterangan||''} onChange={e=>setForm({...form,keterangan:e.target.value})}/></label></div><div className="formactions"><button type="button" className="soft" onClick={cancel}>Batal</button><button className="primary" disabled={loading||upload}>{loading?'Menyimpan...':editing?'Simpan Perubahan':'Simpan Perangkat'}</button></div></form>}

function Detail({a,maint,close,addMaintenance}){return <div className="modal" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modalbox"><button className="close" onClick={close} aria-label="Tutup">×</button><div className="detailtop">{a.fotoUrl?<img src={a.fotoUrl} alt={a.nama}/>:<div className="photo bigphoto">{a.kategori}</div>}<div><div className="eyebrow">DETAIL ASET</div><h2>{a.nama}</h2><p>{a.kodeAset}</p><Status s={a.status}/></div></div><div className="details">{[['Kategori',a.kategori],['Merk / Model',[a.merk,a.model].filter(Boolean).join(' ')],['Serial Number',a.serialNumber],['IP Address',a.ipAddress],['MAC Address',a.macAddress],['Lokasi',a.lokasi],['Kondisi',a.kondisi],['Keterangan',a.keterangan]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]||'-'}</b></div>)}</div><h3>Riwayat Maintenance</h3>{maint.map(m=><div className="maintrow" key={m.id}><div><b>{m.tanggal} · {m.teknisi}</b><span>{m.tindakan||m.keluhan||'-'}</span></div></div>)}{!maint.length&&<p className="muted">Belum ada riwayat maintenance.</p>}<form onSubmit={addMaintenance} className="mini"><input name="tanggal" type="date" required/><input name="teknisi" placeholder="Teknisi" required/><textarea name="keluhan" placeholder="Keluhan"/><textarea name="tindakan" placeholder="Tindakan"/><input name="hasil" placeholder="Hasil"/><button className="primary">Tambah Maintenance</button></form><div className="qr"><QRCodeSVG value={location.origin+location.pathname+'#asset='+a.id} size={150}/><span>Scan QR untuk membuka detail aset</span></div></div></div>}

function Maintenance({assets,maint,selected,setSelected,addMaintenance,removeMaintenance}){return <section className="panel"><div className="panelhead"><div><div className="eyebrow">PEMELIHARAAN PERANGKAT</div><h2>Maintenance</h2><p className="muted">Catat pemeriksaan, perbaikan, dan hasil pekerjaan.</p></div></div><select className="maintenanceSelect" value={selected?.id||''} onChange={e=>setSelected(assets.find(a=>a.id===e.target.value)||null)}><option value="">Pilih perangkat...</option>{assets.map(a=><option value={a.id} key={a.id}>{a.kodeAset} - {a.nama}</option>)}</select>{selected?<form onSubmit={addMaintenance} className="mini maintenanceForm"><input name="tanggal" type="date" required/><input name="teknisi" placeholder="Nama teknisi" required/><textarea name="keluhan" placeholder="Keluhan / masalah"/><textarea name="tindakan" placeholder="Tindakan yang dilakukan"/><input name="hasil" placeholder="Hasil / keterangan akhir"/><button className="primary">Simpan Riwayat</button></form>:<p className="empty">Pilih perangkat untuk menambah maintenance.</p>}<div className="sectionDivider"><h3>Riwayat Terbaru</h3></div>{maint.map(m=><div className="maintrow" key={m.id}><div><b>{m.tanggal} · {m.teknisi}</b><span>{assets.find(a=>a.id===m.assetId)?.nama||'Perangkat dihapus'} — {m.hasil||m.tindakan||m.keluhan||'-'}</span></div><button className="deleteMini" onClick={()=>removeMaintenance(m.id)}>Hapus</button></div>)}{!maint.length&&<p className="empty">Belum ada riwayat maintenance.</p>}</section>}

function Reports({assets,counts}){function exportCSV(){const head=['Kode Aset','Nama','Kategori','Merk','Model','Serial Number','IP Address','MAC Address','Lokasi','Kondisi','Status','Keterangan'];const rows=assets.map(a=>head.map((_,i)=>[a.kodeAset,a.nama,a.kategori,a.merk,a.model,a.serialNumber,a.ipAddress,a.macAddress,a.lokasi,a.kondisi,a.status,a.keterangan][i]||''));const csv=[head,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='laporan-aset-diskominfo-batang.csv';a.click();URL.revokeObjectURL(url)}return <section className="panel report"><div className="panelhead"><div><div className="eyebrow">REKAP DATA</div><h2>Laporan Inventaris</h2><p className="muted">{counts.total} perangkat terdaftar.</p></div><div className="reportActions"><button className="soft" onClick={exportCSV}>Export Excel/CSV</button><button className="primary" onClick={()=>window.print()}>Cetak / PDF</button></div></div><div className="tableWrap"><table><thead><tr><th>Kode</th><th>Perangkat</th><th>Kategori</th><th>Lokasi</th><th>Status</th><th>Kondisi</th></tr></thead><tbody>{assets.map(a=><tr key={a.id}><td>{a.kodeAset}</td><td>{a.nama}</td><td>{a.kategori}</td><td>{a.lokasi||'-'}</td><td><Status s={a.status}/></td><td>{a.kondisi}</td></tr>)}</tbody></table></div>{!assets.length&&<div className="empty">Belum ada data untuk dilaporkan.</div>}</section>}

createRoot(document.getElementById('root')).render(<App/>);
