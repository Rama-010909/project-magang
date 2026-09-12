import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { enableAssetNotifications, updateNotificationPreferences, showAssetNotification } from './notifications';
import pemkabLogo from './assets/pemkab-batang.png';
import pemkabFullLogo from './assets/pemkab-batang-clean.png';
import diskominfoLogo from './assets/diskominfo-batang.jpg';
import './style.css';

// ==========================================
// KONSTANTA & DATA AWAL (DISIKOMINFO BATANG)
// ==========================================
const CATEGORIES = [
  'PC / Laptop',
  'Server',
  'Router',
  'Switch',
  'Access Point',
  'CCTV',
  'NVR / DVR',
  'Printer',
  'UPS',
  'Monitor',
  'Lainnya'
];

const STATUSES = ['Aktif', 'Maintenance', 'Rusak', 'Tidak Digunakan'];
const CONDITIONS = ['Baik', 'Cukup', 'Rusak'];


// Deteksi cerdas lokal (tanpa API/Environment Variables). Skor dihitung dari
// kondisi, status, keterangan, dan riwayat maintenance. Ini bukan model ML
// cloud, tetapi bekerja otomatis di browser dan tetap gratis.
function analyzeAssetTrouble(asset, maintRecords = []) {
  const text = `${asset.nama || ''} ${asset.kondisi || ''} ${asset.status || ''} ${asset.keterangan || ''}`.toLowerCase();
  let score = 0;
  const reasons = [];
  const keywords = ['rusak', 'mati', 'error', 'gagal', 'gangguan', 'trouble', 'down', 'offline', 'tidak menyala', 'putus', 'bermasalah'];
  const hits = keywords.filter(k => text.includes(k));
  if (asset.status === 'Rusak') { score += 85; reasons.push('Status perangkat Rusak'); }
  if (asset.kondisi === 'Rusak') { score += 70; reasons.push('Kondisi perangkat Rusak'); }
  if (asset.status === 'Maintenance') { score += 35; reasons.push('Sedang Maintenance'); }
  if (asset.kondisi === 'Cukup') { score += 15; reasons.push('Kondisi tercatat Cukup'); }
  if (hits.length) { score += Math.min(40, hits.length * 18); reasons.push(`Indikasi: ${hits.slice(0, 3).join(', ')}`); }
  const related = maintRecords.filter(m => m.assetId === asset.id || m.kodeAset === asset.kodeAset);
  if (related.length >= 2) { score += 10; reasons.push('Riwayat maintenance berulang'); }
  score = Math.min(100, score);
  return { score, trouble: score >= 60, reasons };
}

const INITIAL_ASSETS = [
  {
    id: 'ast-001',
    kodeAset: 'AST-BTG-2024-001',
    nama: 'Core Switch Cisco Catalyst 3850',
    kategori: 'Switch',
    merk: 'Cisco',
    model: 'WS-C3850-24T-L',
    serialNumber: 'FOC2134S0AB',
    ipAddress: '10.10.1.1',
    macAddress: '00:1A:2B:3C:4D:5E',
    lokasi: 'Ruang NOC Diskominfo Lt. 2',
    kondisi: 'Baik',
    status: 'Aktif',
    keterangan: 'Switch backbone utama jaringan intra-pemerintah Kabupaten Batang.',
    fotoUrl: '',
    createdAt: '2024-03-15T08:30:00.000Z'
  },
  {
    id: 'ast-002',
    kodeAset: 'AST-BTG-2024-002',
    nama: 'Router Mikrotik CCR1036-8G-2S+',
    kategori: 'Router',
    merk: 'MikroTik',
    model: 'Cloud Core Router CCR1036',
    serialNumber: '4C5E0C881234',
    ipAddress: '10.10.1.254',
    macAddress: '4C:5E:0C:88:12:34',
    lokasi: 'Ruang Server NOC Lt. 2',
    kondisi: 'Baik',
    status: 'Aktif',
    keterangan: 'Gateway routing internet terpusat OPD Kabupaten Batang.',
    fotoUrl: '',
    createdAt: '2024-04-10T10:00:00.000Z'
  },
  {
    id: 'ast-003',
    kodeAset: 'AST-BTG-2025-003',
    nama: 'Server Dell PowerEdge R740',
    kategori: 'Server',
    merk: 'Dell EMC',
    model: 'PowerEdge R740 Rack 2U',
    serialNumber: '8HQ29Z2',
    ipAddress: '10.10.2.10',
    macAddress: 'D4:BE:D9:11:22:33',
    lokasi: 'Data Center Diskominfo',
    kondisi: 'Baik',
    status: 'Aktif',
    keterangan: 'Host virtualisasi portal web resmi batangkab.go.id dan layanan publik.',
    fotoUrl: '',
    createdAt: '2025-01-20T14:15:00.000Z'
  },
  {
    id: 'ast-004',
    kodeAset: 'AST-BTG-2025-004',
    nama: 'PC All-in-One HP ProOne 440 G9',
    kategori: 'PC / Laptop',
    merk: 'HP',
    model: 'ProOne 440 G9 AiO 24"',
    serialNumber: '5CD3128790',
    ipAddress: '10.10.3.45',
    macAddress: '70:85:C2:55:66:77',
    lokasi: 'Ruang Bidang IKP Lt. 1',
    kondisi: 'Baik',
    status: 'Aktif',
    keterangan: 'Komputer operasional produksi konten berita & media sosial Diskominfo.',
    fotoUrl: '',
    createdAt: '2025-02-05T09:45:00.000Z'
  },
  {
    id: 'ast-005',
    kodeAset: 'AST-BTG-2025-005',
    nama: 'Access Point UniFi U6 Pro',
    kategori: 'Access Point',
    merk: 'Ubiquiti',
    model: 'UniFi 6 Pro (U6-Pro)',
    serialNumber: '68D79A8899AA',
    ipAddress: '10.10.4.15',
    macAddress: '68:D7:9A:88:99:AA',
    lokasi: 'Aula Pertemuan Kantor Diskominfo',
    kondisi: 'Cukup',
    status: 'Maintenance',
    keterangan: 'Sedang pengecekan interferensi sinyal Wi-Fi 6 dan pembaruan firmware controller.',
    fotoUrl: '',
    createdAt: '2025-06-18T11:20:00.000Z'
  },
  {
    id: 'ast-006',
    kodeAset: 'AST-BTG-2025-006',
    nama: 'CCTV IP Camera Hikvision Outdoor',
    kategori: 'CCTV',
    merk: 'Hikvision',
    model: 'DS-2CD2043G2-I 4MP',
    serialNumber: 'HK20250918',
    ipAddress: '10.10.5.21',
    macAddress: 'AC:CC:8E:10:20:30',
    lokasi: 'Gerbang Masuk Pemkab Batang',
    kondisi: 'Baik',
    status: 'Aktif',
    keterangan: 'Terkoneksi ke Command Center Batang Smart City.',
    fotoUrl: '',
    createdAt: '2025-08-12T16:00:00.000Z'
  },
  {
    id: 'ast-007',
    kodeAset: 'AST-BTG-2026-007',
    nama: 'UPS APC Smart-UPS RT 5000VA',
    kategori: 'UPS',
    merk: 'Schneider / APC',
    model: 'SRT5KRMXLI Online Rack',
    serialNumber: 'AS194820019',
    ipAddress: '10.10.2.250',
    macAddress: '00:C0:B7:AA:BB:CC',
    lokasi: 'Rack Server Data Center Lt. 2',
    kondisi: 'Baik',
    status: 'Aktif',
    keterangan: 'Backup daya darurat 5kVA untuk rak server utama.',
    fotoUrl: '',
    createdAt: '2026-01-15T08:00:00.000Z'
  },
  {
    id: 'ast-008',
    kodeAset: 'AST-BTG-2026-008',
    nama: 'Printer Laser Multifungsi Canon iR2625i',
    kategori: 'Printer',
    merk: 'Canon',
    model: 'imageRUNNER 2625i',
    serialNumber: 'CN2625-8831',
    ipAddress: '10.10.3.90',
    macAddress: '00:1E:8F:33:44:55',
    lokasi: 'Ruang Sekretariat Diskominfo',
    kondisi: 'Rusak',
    status: 'Rusak',
    keterangan: 'Fuser unit error E000001, menunggu pengadaan suku cadang pemanas roller.',
    fotoUrl: '',
    createdAt: '2026-02-01T13:10:00.000Z'
  }
];

const INITIAL_MAINT = [
  {
    id: 'mnt-001',
    assetId: 'ast-005',
    tanggal: '2026-03-02',
    teknisi: 'Budi Santoso (Jaringan Diskominfo)',
    keluhan: 'Koneksi WiFi sering lambat dan putus saat kapasitas peserta aula penuh.',
    tindakan: 'Re-routing kabel LAN Cat6, cek suplai PoE switch, dan kalibrasi channel 5GHz.',
    hasil: 'Perangkat masih dalam pemantauan (status: Maintenance).',
    createdAt: '2026-03-02T09:00:00.000Z'
  },
  {
    id: 'mnt-002',
    assetId: 'ast-008',
    tanggal: '2026-02-28',
    teknisi: 'Wahyu Pratama (Staf TIK)',
    keluhan: 'Kertas tersangkut (paper jam) berulang dan keluar kode error fuser.',
    tindakan: 'Bongkar unit pemanas, pembersihan sensor suhu drum, identifikasi roller sobek.',
    hasil: 'Diusulkan pergantian suku cadang pemanas (status: Rusak).',
    createdAt: '2026-02-28T11:30:00.000Z'
  },
  {
    id: 'mnt-003',
    assetId: 'ast-001',
    tanggal: '2026-01-10',
    teknisi: 'Budi Santoso',
    keluhan: 'Perawatan berkala rutin awal tahun kuartal I.',
    tindakan: 'Backup konfigurasi switch via TFTP server, pembersihan debu fisik casing, cek temperatur.',
    hasil: 'Kondisi switch sangat prima, uptime 99.9%.',
    createdAt: '2026-01-10T14:00:00.000Z'
  }
];

const EMPTY_FORM = {
  kodeAset: '',
  nama: '',
  kategori: 'PC / Laptop',
  merk: '',
  model: '',
  serialNumber: '',
  ipAddress: '',
  macAddress: '',
  lokasi: '',
  latitude: '',
  longitude: '',
  kondisi: 'Baik',
  status: 'Aktif',
  keterangan: '',
  fotoUrl: '',
  monitorUrl: ''
};

// ==========================================
// SVG ICONS (CLEAN & MODERN)
// ==========================================
const Icons = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  Box: () => (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  Wrench: () => (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.9 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  FileText: () => (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  ),
  EyeOff: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 3 18 18" />
      <path d="M10.6 6.2C11.05 6.07 11.52 6 12 6c6.1 0 9.5 6 9.5 6a16.8 16.8 0 0 1-3.1 3.7" />
      <path d="M6.2 6.9C3.8 8.3 2.5 12 2.5 12s3.4 6 9.5 6c1.15 0 2.2-.2 3.15-.52" />
      <path d="M9.9 9.9a2.7 2.7 0 0 0 3.8 3.8" />
    </svg>
  ),
  QrCode: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="3" height="3" />
      <rect x="18" y="18" width="3" height="3" />
      <rect x="14" y="18" width="3" height="3" />
      <rect x="18" y="14" width="3" height="3" />
    </svg>
  ),
  Printer: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  Download: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Logout: () => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Grid: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  List: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  MapPin: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Copy: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  ShieldCheck: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Monitor: () => (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M7 9h.01M10 9h7M7 12h.01M10 12h5" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
};

// ==========================================
// HELPER UI — LOGO PREVIEW & GOOGLE MAPS
// ==========================================
function mapsUrl(location, latitude = '', longitude = '') {
  const query = latitude && longitude ? `${latitude},${longitude}` : location;
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '#';
}

function mapsEmbedUrl(location, latitude = '', longitude = '') {
  const query = latitude && longitude ? `${latitude},${longitude}` : location;
  return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : '';
}

function MapsLink({ location, latitude, longitude, children }) {
  if (!location && !(latitude && longitude)) return <>{children || 'Lokasi belum diisi'}</>;
  return (
    <a className="mapsLink" href={mapsUrl(location, latitude, longitude)} target="_blank" rel="noreferrer" title="Buka lokasi di Google Maps">
      {children || location || `${latitude}, ${longitude}`}
    </a>
  );
}

function InteractiveMap({ markers = [] }) {
  const points = markers.filter(a => Number.isFinite(Number(a.latitude)) && Number.isFinite(Number(a.longitude)));
  if (!points.length) {
    return (
      <div className="interactiveMapFallback">
        <Icons.MapPin />
        <div><b>Belum ada titik koordinat aset</b><span>Atur lokasi melalui form aset untuk menampilkan peta di sini.</span></div>
      </div>
    );
  }
  const first = points[0];
  const lat = Number(first.latitude);
  const lng = Number(first.longitude);
  const delta = 0.01;
  const bbox = `${lng-delta},${lat-delta},${lng+delta},${lat+delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
  return (
    <div className="interactiveMapWrap">
      <iframe className="interactiveMapFrame" title="Peta lokasi aset" src={src} loading="lazy" />
      <div className="mapMarkerList">
        {points.slice(0, 8).map(a => (
          <a key={a.id} href={mapsUrl(a.lokasi, a.latitude, a.longitude)} target="_blank" rel="noreferrer" className="mapMarkerItem">
            <Icons.MapPin /><span><b>{a.nama || 'Perangkat'}</b><small>{a.lokasi || `${a.latitude}, ${a.longitude}`}</small></span>
          </a>
        ))}
      </div>
      {points.length > 8 && <small className="mapMoreHint">+ {points.length - 8} lokasi lainnya tersedia di Inventaris.</small>}
    </div>
  );
}

function GoogleMapPreview({ location, latitude = '', longitude = '', compact = false }) {
  const embed = mapsEmbedUrl(location, latitude, longitude);
  if (!embed) {
    return (
      <div className={`mapPreviewEmpty ${compact ? 'compact' : ''}`}>
        <Icons.MapPin />
        <span>Isi lokasi untuk menampilkan penanda di Google Maps.</span>
      </div>
    );
  }
  return (
    <div className={`googleMapPreview ${compact ? 'compact' : ''}`}>
      <iframe
        title="Peta lokasi aset"
        src={embed}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

function LocationPicker({ value, latitude = '', longitude = '', onChange }) {
  const [query, setQuery] = useState(value || '');
  const [mapLocation, setMapLocation] = useState(value || '');
  const [mapLat, setMapLat] = useState(latitude || '');
  const [mapLng, setMapLng] = useState(longitude || '');

  useEffect(() => {
    setQuery(value || '');
    setMapLocation(value || '');
    setMapLat(latitude || '');
    setMapLng(longitude || '');
  }, [value, latitude, longitude]);

  function applyLocation() {
    const text = query.trim();
    setMapLocation(text);
    setMapLat('');
    setMapLng('');
    onChange({ lokasi: text, latitude: '', longitude: '' });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert('Browser ini tidak mendukung lokasi perangkat.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lat = coords.latitude.toFixed(6);
        const lng = coords.longitude.toFixed(6);
        setMapLat(lat);
        setMapLng(lng);
        setMapLocation(`${lat}, ${lng}`);
        setQuery(`${lat}, ${lng}`);
        onChange({ lokasi: `${lat}, ${lng}`, latitude: lat, longitude: lng });
      },
      () => alert('Lokasi perangkat tidak dapat diambil. Pastikan izin lokasi browser sudah diberikan.')
    );
  }

  const hasLocation = query.trim() || mapLocation || (mapLat && mapLng);

  return (
    <div className="locationPicker">
      <div className="locationInputRow">
        <input
          type="text"
          placeholder="Cari alamat / ruangan, mis. Kantor Diskominfo Batang"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLocation(); } }}
        />
        <button type="button" className="btnLight mapActionBtn" onClick={applyLocation}>
          <Icons.MapPin />
          <span>Tampilkan Peta</span>
        </button>
      </div>
      <div className="locationPickerActions">
        <button type="button" className="mapTextBtn" onClick={useMyLocation}>Gunakan lokasi perangkat</button>
        {hasLocation && (
          <a className="mapTextBtn" href={mapsUrl(mapLocation || query, mapLat, mapLng)} target="_blank" rel="noreferrer">Buka Google Maps</a>
        )}
      </div>
      <GoogleMapPreview location={mapLocation || query} latitude={mapLat} longitude={mapLng} />
      <span className="fieldHelper">Peta akan menampilkan penanda berdasarkan alamat atau koordinat yang dipilih. Untuk titik GPS yang lebih presisi, gunakan tombol lokasi perangkat.</span>
    </div>
  );
}

function ClickableLogo({ src, alt, className, wrapperClassName = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`clickableLogo ${wrapperClassName}`} onClick={() => setOpen(true)} title={`Lihat ${alt}`}>
        <img src={src} alt={alt} className={className} />
      </button>
      {open && (
        <div className="logoPreviewOverlay" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="logoPreviewCard">
            <button type="button" className="logoPreviewClose" onClick={() => setOpen(false)} aria-label="Tutup">×</button>
            <div className="logoPreviewMedia">
              <img src={src} alt={alt} className="logoPreviewImage" />
            </div>
            <div className="logoPreviewTitle">{alt}</div>
            <div className="logoPreviewHint">Klik di luar area untuk menutup</div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// APLIKASI UTAMA (APP)
// ==========================================
function App() {
  // Authentication
  const [login, setLogin] = useState(() => {
    return sessionStorage.getItem('it_asset_auth') === 'true';
  });
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Navigation
  const [page, setPage] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  const [labelPrintAsset, setLabelPrintAsset] = useState(null);

  // Data state — Firestore adalah sumber data utama. Tidak ada fallback localStorage.
  const [assets, setAssets] = useState([]);
  const [maint, setMaint] = useState([]);
  const [agentMonitorStates, setAgentMonitorStates] = useState({});

  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [firebaseChecked, setFirebaseChecked] = useState(false);

  // Status dari Local LAN Monitor Agent (tetap bisa diperbarui walau tab web tidak melakukan ping).
  useEffect(() => {
    if (!login) return;
    const unsub = onSnapshot(collection(db, 'monitorStatus'), snapshot => {
      const rows = {};
      snapshot.docs.forEach(d => { rows[d.id] = { id: d.id, ...d.data(), source: 'agent' }; });
      setAgentMonitorStates(rows);
    }, err => console.warn('Monitor agent status:', err));
    return () => unsub();
  }, [login]);

  // Search, Filter & View
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [catFilter, setCatFilter] = useState('Semua');
  const [condFilter, setCondFilter] = useState('Semua');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Forms
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(() => localStorage.getItem('asset_notification_enabled') === 'true');
  const [notificationTrouble, setNotificationTrouble] = useState(() => localStorage.getItem('asset_notify_trouble') !== 'false');
  const [notificationMaintenance, setNotificationMaintenance] = useState(() => localStorage.getItem('asset_notify_maintenance') !== 'false');
  const [notificationBusy, setNotificationBusy] = useState(false);
  const notificationEnabledRef = useRef(notificationEnabled);
  const notificationTroubleRef = useRef(notificationTrouble);
  const notificationMaintenanceRef = useRef(notificationMaintenance);
  const aiAlertedRef = useRef(new Set());
  notificationEnabledRef.current = notificationEnabled;
  notificationTroubleRef.current = notificationTrouble;
  notificationMaintenanceRef.current = notificationMaintenance;

  // Sinkronisasi Waktu Lokal
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) +
          ' • ' +
          now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
          ' WIB'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Service Worker dapat dipasang tanpa meminta izin notifikasi.
  useEffect(() => {
    if (!login) return;
    return () => {};
  }, [login]);

  async function handleEnableNotifications() {
    setNotificationBusy(true);
    try {
      const result = await enableAssetNotifications({
        notifyTrouble: notificationTrouble,
        notifyMaintenance: notificationMaintenance
      });
      setNotificationEnabled(true);
      localStorage.setItem('asset_notification_enabled', 'true');
      localStorage.setItem('asset_notify_trouble', String(notificationTrouble));
      localStorage.setItem('asset_notify_maintenance', String(notificationMaintenance));
      setToast('Notifikasi perangkat berhasil diaktifkan');
    } catch (e) {
      alert('Notifikasi belum dapat diaktifkan: ' + e.message);
    } finally {
      setNotificationBusy(false);
    }
  }

  async function saveNotificationPreferences(nextTrouble = notificationTrouble, nextMaintenance = notificationMaintenance) {
    setNotificationTrouble(nextTrouble);
    setNotificationMaintenance(nextMaintenance);
    localStorage.setItem('asset_notify_trouble', String(nextTrouble));
    localStorage.setItem('asset_notify_maintenance', String(nextMaintenance));
    await updateNotificationPreferences({ notifyTrouble: nextTrouble, notifyMaintenance: nextMaintenance });
  }

  function sendAssetNotification(type, asset) {
    if (!notificationEnabled) return;
    if (type === 'trouble' && !notificationTrouble) return;
    if (type === 'maintenance' && !notificationMaintenance) return;
    showAssetNotification({ type, asset });
  }

  // Sinkronisasi penuh dengan Cloud Firestore
  useEffect(() => {
    let unsubAssets = () => {};
    let unsubMaint = () => {};
    let cancelled = false;

    async function initFirestore() {
      try {
        // Jika koleksi benar-benar kosong, isi sekali dengan data contoh bawaan.
        const assetSnap = await getDocs(collection(db, 'assets'));
        if (assetSnap.empty) {
          const batch = writeBatch(db);
          INITIAL_ASSETS.forEach(item => {
            const ref = doc(db, 'assets', item.id);
            batch.set(ref, item);
          });
          INITIAL_MAINT.forEach(item => {
            const ref = doc(db, 'maintenance', item.id);
            batch.set(ref, item);
          });
          await batch.commit();
        }

        if (cancelled) return;

        unsubAssets = onSnapshot(
          collection(db, 'assets'),
          snapshot => {
            const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

            // Deteksi cerdas lokal: menganalisis aset setiap kali Firestore berubah.
            // Notifikasi hanya dikirim sekali untuk satu kondisi agar tidak spam.
            const previousMap = window.__assetNotificationSnapshot || null;
            rows.forEach(asset => {
              const ai = analyzeAssetTrouble(asset, window.__maintenanceNotificationRows || []);
              const before = previousMap?.get(asset.id);
              const changedToTrouble = asset.status === 'Rusak' && before?.status !== 'Rusak';
              const aiKey = `${asset.id}:${asset.updatedAt?.seconds || asset.updatedAt || asset.status || asset.kondisi}`;
              if (ai.trouble && notificationEnabledRef.current && notificationTroubleRef.current && !aiAlertedRef.current.has(aiKey)) {
                if (previousMap && (changedToTrouble || ai.score >= 60)) {
                  showAssetNotification({ type: 'trouble', asset: { ...asset, aiScore: ai.score, aiReason: ai.reasons.join(' • ') } });
                  aiAlertedRef.current.add(aiKey);
                }
              }
            });
            if (previousMap) {
              rows.forEach(asset => {
                const before = previousMap.get(asset.id);
                const changedToMaintenance = asset.status === 'Maintenance' && before?.status !== 'Maintenance';
                if (changedToMaintenance && notificationEnabledRef.current && notificationMaintenanceRef.current) {
                  sendAssetNotification('maintenance', asset);
                }
              });
            }
            window.__assetNotificationSnapshot = new Map(rows.map(a => [a.id, a]));

            setAssets(rows);
            setIsFirebaseConnected(true);
            setFirebaseChecked(true);
          },
          err => {
            console.error('Firestore assets:', err);
            setIsFirebaseConnected(false);
            setFirebaseChecked(true);
            setToast('Firestore tidak dapat diakses: ' + (err.message || 'periksa Rules'));
          }
        );

        unsubMaint = onSnapshot(
          collection(db, 'maintenance'),
          snapshot => {
            const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            rows.sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
            window.__maintenanceNotificationRows = rows;
            setMaint(rows);
          },
          err => console.error('Firestore maintenance:', err)
        );
      } catch (err) {
        console.error('Firestore init:', err);
        setIsFirebaseConnected(false);
        setFirebaseChecked(true);
        setToast('Gagal terhubung ke Firestore: ' + (err.message || 'periksa konfigurasi Firebase'));
      }
    }

    initFirestore();
    return () => {
      cancelled = true;
      unsubAssets();
      unsubMaint();
    };
  }, []);

  // Hash URL sync (#asset=id)
  useEffect(() => {
    const match = location.hash.match(/^#asset=(.+)$/);
    if (match) {
      const a = assets.find(x => x.id === match[1]);
      if (a) setSelected(a);
    }
  }, [assets]);

  // Toast timer
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3200);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Statistik Aset
  const counts = useMemo(() => {
    return {
      total: assets.length,
      aktif: assets.filter(x => x.status === 'Aktif').length,
      maint: assets.filter(x => x.status === 'Maintenance').length,
      rusak: assets.filter(x => x.status === 'Rusak').length,
      idle: assets.filter(x => x.status === 'Tidak Digunakan').length
    };
  }, [assets]);

  // Filter & Search
  const [monitorStates, setMonitorStates] = useState({});
  const monitorStatesRef = useRef({});
  const [monitorTick, setMonitorTick] = useState(0);

  useEffect(() => {
    monitorStatesRef.current = monitorStates;
  }, [monitorStates]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const next = { ...monitorStatesRef.current };
      for (const asset of assets) {
        const url = asset.monitorUrl || (asset.ipAddress ? `http://${asset.ipAddress}` : '');
        if (!url) continue;
        const started = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        try {
          await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
          next[asset.id] = { online: true, latency: Date.now() - started, checkedAt: Date.now(), consecutiveFail: 0 };
        } catch (e) {
          const prev = next[asset.id] || {};
          next[asset.id] = { online: false, latency: null, checkedAt: Date.now(), consecutiveFail: (prev.consecutiveFail || 0) + 1 };
          if ((prev.consecutiveFail || 0) < 2 && notificationEnabledRef.current && notificationTroubleRef.current) {
            showAssetNotification({ type: 'trouble', asset: { ...asset, status: 'Offline / indikasi trouble', aiScore: 90, aiReason: 'Perangkat tidak merespons pemeriksaan koneksi' } });
          }
        } finally { clearTimeout(timer); }
      }
      if (!cancelled) { setMonitorStates(next); monitorStatesRef.current = next; setMonitorTick(x => x + 1); }
    };
    if (assets.length) check();
    const id = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [assets.length]);

  const monitorAlertsCount = assets.filter(a => monitorStates[a.id] && monitorStates[a.id].online === false && monitorStates[a.id].consecutiveFail >= 2).length;

  const filteredAssets = useMemo(() => {
    return assets
      .filter(item => {
        const matchesStatus = statusFilter === 'Semua' || item.status === statusFilter;
        const matchesCat = catFilter === 'Semua' || item.kategori === catFilter;
        const matchesCond = condFilter === 'Semua' || item.kondisi === condFilter;
        const searchTarget = `${item.kodeAset} ${item.nama} ${item.merk} ${item.model} ${item.lokasi} ${item.ipAddress} ${item.macAddress} ${item.serialNumber} ${item.kategori}`.toLowerCase();
        const matchesSearch = !search || searchTarget.includes(search.toLowerCase().trim());
        return matchesStatus && matchesCat && matchesCond && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'name-asc') return (a.nama || '').localeCompare(b.nama || '');
        if (sortBy === 'name-desc') return (b.nama || '').localeCompare(a.nama || '');
        if (sortBy === 'code') return (a.kodeAset || '').localeCompare(b.kodeAset || '');
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [assets, search, statusFilter, catFilter, condFilter, sortBy]);

  // Navigasi
  function go(p) {
    setPage(p);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Buka Form Tambah Baru
  function openAdd() {
    const nextNum = String(assets.length + 1).padStart(3, '0');
    const autoCode = `AST-BTG-2026-${nextNum}`;
    setForm({ ...EMPTY_FORM, kodeAset: autoCode });
    setEditing(null);
    go('form');
  }

  // Buka Form Edit
  function openEdit(a) {
    setForm({ ...EMPTY_FORM, ...a });
    setEditing(a.id);
    go('form');
  }

  // Simpan Aset — selalu ke Firestore
  async function saveAsset(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!isFirebaseConnected) throw new Error('Firestore belum terhubung. Periksa Firebase Web App dan Rules.');

      const previous = editing ? assets.find(a => a.id === editing) : null;
      const payload = {
        ...form,
        updatedAt: serverTimestamp()
      };
      let savedId = editing;

      if (editing) {
        await updateDoc(doc(db, 'assets', editing), payload);
      } else {
        const docRef = await addDoc(collection(db, 'assets'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        savedId = docRef.id;
      }

      const savedAsset = { ...form, id: savedId };
      setToast(editing ? 'Data perangkat berhasil diperbarui' : 'Perangkat baru berhasil ditambahkan');
      setForm(EMPTY_FORM);
      setEditing(null);
      go('inventaris');
    } catch (err) {
      alert('Gagal menyimpan ke Firestore: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Hapus Aset
  async function removeAsset(id) {
    const target = assets.find(a => a.id === id);
    if (!confirm(`Hapus perangkat "${target?.nama || id}"? Data yang dihapus tidak dapat dikembalikan.`)) return;

    try {
      if (!isFirebaseConnected) throw new Error('Firestore belum terhubung.');
      await deleteDoc(doc(db, 'assets', id));
      if (selected?.id === id) setSelected(null);
      setToast('Perangkat berhasil dihapus dari inventaris');
    } catch (e) {
      alert('Gagal menghapus: ' + e.message);
    }
  }

  // Tambah Riwayat Maintenance — selalu ke Firestore
  async function addMaintenanceRecord(record, targetAssetId, newStatus) {
    try {
      if (!isFirebaseConnected) throw new Error('Firestore belum terhubung.');
      await addDoc(collection(db, 'maintenance'), {
        ...record,
        assetId: targetAssetId,
        createdAt: serverTimestamp()
      });
      const target = assets.find(a => a.id === targetAssetId);
      if (newStatus) {
        await updateDoc(doc(db, 'assets', targetAssetId), {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
      }
      setToast('Riwayat maintenance berhasil dicatat');
    } catch (e) {
      alert('Gagal mencatat maintenance ke Firestore: ' + e.message);
    }
  }

  // Hapus Riwayat Maintenance
  async function removeMaintenanceRecord(id) {
    if (!confirm('Hapus riwayat maintenance ini?')) return;
    try {
      if (!isFirebaseConnected) throw new Error('Firestore belum terhubung.');
      await deleteDoc(doc(db, 'maintenance', id));
      setToast('Riwayat pemeliharaan berhasil dihapus');
    } catch (e) {
      alert('Gagal menghapus riwayat: ' + e.message);
    }
  }

  // Sesi Login / Logout
  function handleLogin(e) {
    if (e) e.preventDefault();
    if (username.trim() === 'admin' && pass === 'kominfobatang') {
      sessionStorage.setItem('it_asset_auth', 'true');
      setLogin(true);
      setUsername('');
      setPass('');
    } else {
      alert('Username atau password salah.');
    }
  }

  function handleLogout() {
    if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
      sessionStorage.removeItem('it_asset_auth');
      setLogin(false);
    }
  }

  if (!login) {
    return (
      <LoginView
        username={username}
        pass={pass}
        setUsername={setUsername}
        setPass={setPass}
        showPass={showPass}
        setShowPass={setShowPass}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="appLayout">
      {/* SIDEBAR DESKTOP */}
      <aside className="sidebar">
        <div className="sidebarBrand">
          <ClickableLogo src={pemkabFullLogo} alt="Pemerintah Kabupaten Batang" className="sidebarFullLogoImg" wrapperClassName="sidebarFullLogoCard" />
          <div className="sidebarSubBrand">
            <ClickableLogo src={diskominfoLogo} alt="Diskominfo Batang" className="sidebarDiskominfoMini" wrapperClassName="sidebarDiskominfoMiniHolder" />
            <div className="sidebarBrandText">
              <b className="appName">IT ASSET MGMT</b>
              <span className="deptSubtext">Dinas Komunikasi & Informatika</span>
            </div>
          </div>
        </div>

        <div className="sidebarConnection">
          <span className={`statusDot ${isFirebaseConnected ? 'online' : 'local'}`} />
          <span className="connectionLabel">
            {isFirebaseConnected ? 'Cloud Firebase Aktif' : 'Penyimpanan Lokal Aktif'}
          </span>
        </div>

        <nav className="sidebarNav">
          <button
            className={`navItem ${page === 'dashboard' ? 'active' : ''}`}
            onClick={() => go('dashboard')}
          >
            <span className="navIcon"><Icons.Dashboard /></span>
            <span className="navLabel">Dashboard</span>
          </button>

          <button
            className={`navItem ${page === 'inventaris' ? 'active' : ''}`}
            onClick={() => go('inventaris')}
          >
            <span className="navIcon"><Icons.Box /></span>
            <span className="navLabel">Inventaris Aset</span>
            <span className="badgeCount">{counts.total}</span>
          </button>

          <button
            className={`navItem ${page === 'monitor' ? 'active' : ''}`}
            onClick={() => go('monitor')}
          >
            <span className="navIcon"><Icons.Monitor /></span>
            <span className="navLabel">Monitoring</span>
            {monitorAlertsCount > 0 && <span className="badgeAlert">{monitorAlertsCount}</span>}
          </button>

          <button
            className={`navItem ${page === 'maintenance' ? 'active' : ''}`}
            onClick={() => go('maintenance')}
          >
            <span className="navIcon"><Icons.Wrench /></span>
            <span className="navLabel">Maintenance</span>
            {counts.maint > 0 && <span className="badgeAlert">{counts.maint}</span>}
          </button>

          <button
            className={`navItem ${page === 'laporan' ? 'active' : ''}`}
            onClick={() => go('laporan')}
          >
            <span className="navIcon"><Icons.FileText /></span>
            <span className="navLabel">Laporan & Rekap</span>
          </button>
        </nav>

        <div className="sidebarFooter">
          <div className="userCard">
            <div className="userAvatar">AD</div>
            <div className="userInfo">
              <span className="userName">Administrator</span>
              <span className="userRole">Pengelola Aset TIK</span>
            </div>
          </div>
          <button className="logoutButton" onClick={handleLogout} title="Keluar dari sistem">
            <Icons.Logout />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <header className="mobileTopBar">
        <div className="mobileBrand">
          <div className="mobileFullLogoCard">
            <ClickableLogo src={pemkabFullLogo} alt="Pemerintah Kabupaten Batang" className="mobileFullLogoImg" />
          </div>
        </div>
        <div className="mobileActions">
          <button
            type="button"
            className={`mobileNotificationBtn ${notificationEnabled ? 'enabled' : ''}`}
            onClick={() => setShowNotificationSettings(true)}
            title="Notifikasi"
          >
            <Icons.Bell />
          </button>
          <div className="mobileDiskominfoMini">
            <img src={diskominfoLogo} alt="Diskominfo" />
          </div>
          <button className="mobileLogout" onClick={handleLogout} title="Keluar">
            <Icons.Logout />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="mainContent">
        {/* HEADER BAR */}
        <header className="pageHeader">
          <div className="headerLeft">
            <div className="headerBreadcrumb">
              <Icons.ShieldCheck />
              <span>PORTAL RESMI DISKOMINFO KABUPATEN BATANG</span>
              {timeStr && <span className="headerClock">• {timeStr}</span>}
            </div>
            <h1 className="headerTitle">
              {page === 'dashboard' && 'Dashboard Operasional'}
              {page === 'inventaris' && 'Inventaris Perangkat IT'}
              {page === 'monitor' && 'Monitoring Perangkat'}
              {page === 'form' && (editing ? 'Perbarui Data Perangkat' : 'Tambah Perangkat Baru')}
              {page === 'maintenance' && 'Riwayat & Jadwal Pemeliharaan'}
              {page === 'laporan' && 'Laporan Rekapitulasi Aset'}
            </h1>
            <p className="headerDesc">
              {page === 'dashboard' && 'Ringkasan menyeluruh kondisi infrastruktur jaringan, server, dan komputer.'}
              {page === 'inventaris' && 'Pencatatan lengkap perangkat keras, spesifikasi teknis, IP Address, dan lokasi.'}
              {page === 'monitor' && 'Pantau respons perangkat dan indikasi trouble secara otomatis.'}
              {page === 'form' && 'Lengkapi rincian identitas perangkat untuk inventarisasi Barang Milik Daerah (BMD).'}
              {page === 'maintenance' && 'Dokumentasi penanganan kendala teknis, perbaikan perangkat, dan hasil uji.'}
              {page === 'laporan' && 'Cetak format resmi atau ekspor tabel inventaris untuk kebutuhan audit & pembukuan.'}
            </p>
          </div>

          <div className="headerRight">
            <button
              type="button"
              className={`notificationBellBtn ${notificationEnabled ? 'enabled' : ''}`}
              onClick={() => setShowNotificationSettings(true)}
              title={notificationEnabled ? 'Pengaturan notifikasi' : 'Aktifkan notifikasi'}
            >
              <Icons.Bell />
              <span className="notificationBellDot" />
            </button>
            {page !== 'form' && (
              <button className="btnPrimary addDeviceBtn" onClick={openAdd}>
                <Icons.Plus />
                <span>Tambah Perangkat</span>
              </button>
            )}
          </div>
        </header>

        {/* CONTENT VIEW SWITCHER */}
        {page === 'dashboard' && (
          <DashboardView
            counts={counts}
            assets={assets}
            maint={maint}
            aiAlerts={assets.map(a => ({ asset: a, ...analyzeAssetTrouble(a, maint) })).filter(x => x.trouble).sort((a,b) => b.score-a.score).slice(0,5)}
            setSelected={a => {
              setSelected(a);
              location.hash = 'asset=' + a.id;
            }}
            go={go}
            openAdd={openAdd}
          />
        )}

        {page === 'inventaris' && (
          <InventoryView
            assets={filteredAssets}
            totalCount={assets.length}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            catFilter={catFilter}
            setCatFilter={setCatFilter}
            condFilter={condFilter}
            setCondFilter={setCondFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            viewMode={viewMode}
            setViewMode={setViewMode}
            openEdit={openEdit}
            removeAsset={removeAsset}
            onOpenDetail={a => {
              setSelected(a);
              location.hash = 'asset=' + a.id;
            }}
            openAdd={openAdd}
          />
        )}

        {page === 'form' && (
          <AssetFormView
            form={form}
            setForm={setForm}
            saveAsset={saveAsset}
            loading={loading}
            editing={editing}
            cancel={() => go('inventaris')}
          />
        )}

        {page === 'monitor' && (
          <MonitoringView
            assets={assets}
            monitorStates={{ ...monitorStates, ...agentMonitorStates }}
            aiAlerts={assets.map(a => ({ asset: a, ...analyzeAssetTrouble(a, maint), monitor: agentMonitorStates[a.id] || monitorStates[a.id] })).filter(x => x.trouble || x.monitor?.online === false)}
            go={go}
          />
        )}

        {page === 'maintenance' && (
          <MaintenanceView
            assets={assets}
            maint={maint}
            selectedAsset={selected}
            setSelectedAsset={setSelected}
            addMaintenanceRecord={addMaintenanceRecord}
            removeMaintenanceRecord={removeMaintenanceRecord}
          />
        )}

        {page === 'laporan' && (
          <ReportsView
            assets={assets}
            counts={counts}
            pemkabLogo={pemkabLogo}
            pemkabFullLogo={pemkabFullLogo}
            diskominfoLogo={diskominfoLogo}
          />
        )}

        {/* MODAL DETAIL ASET */}
        {selected && (
          <DetailModal
            asset={selected}
            maintList={maint.filter(m => m.assetId === selected.id)}
            closeModal={() => {
              setSelected(null);
              if (location.hash) history.replaceState(null, '', location.pathname + location.search);
            }}
            onEdit={() => {
              openEdit(selected);
              setSelected(null);
            }}
            onDelete={() => removeAsset(selected.id)}
            addMaintenanceRecord={addMaintenanceRecord}
            onPrintLabel={() => setLabelPrintAsset(selected)}
          />
        )}

        {/* MODAL PRINT STIKER LABEL QR */}
        {labelPrintAsset && (
          <PrintLabelModal
            asset={labelPrintAsset}
            pemkabFullLogo={pemkabFullLogo}
            diskominfoLogo={diskominfoLogo}
            closeModal={() => setLabelPrintAsset(null)}
          />
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="mobileBottomNav">
        <button
          className={`mobNavItem ${page === 'dashboard' ? 'active' : ''}`}
          onClick={() => go('dashboard')}
        >
          <Icons.Dashboard />
          <span>Beranda</span>
        </button>

        <button
          className={`mobNavItem ${page === 'inventaris' ? 'active' : ''}`}
          onClick={() => go('inventaris')}
        >
          <Icons.Box />
          <span>Inventaris</span>
        </button>

        <button
          className={`mobNavItem ${page === 'form' ? 'active' : ''}`}
          onClick={openAdd}
        >
          <div className="mobNavFab">
            <Icons.Plus />
          </div>
          <span>Tambah</span>
        </button>

        <button
          className={`mobNavItem ${page === 'maintenance' ? 'active' : ''}`}
          onClick={() => go('maintenance')}
        >
          <Icons.Wrench />
          <span>Servis</span>
        </button>

        <button
          className={`mobNavItem ${page === 'laporan' ? 'active' : ''}`}
          onClick={() => go('laporan')}
        >
          <Icons.FileText />
          <span>Laporan</span>
        </button>
      </nav>

      {showNotificationSettings && (
        <NotificationSettingsModal
          enabled={notificationEnabled}
          trouble={notificationTrouble}
          maintenance={notificationMaintenance}
          busy={notificationBusy}
          onEnable={handleEnableNotifications}
          onToggleTrouble={value => saveNotificationPreferences(value, notificationMaintenance)}
          onToggleMaintenance={value => saveNotificationPreferences(notificationTrouble, value)}
          onClose={() => setShowNotificationSettings(false)}
        />
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="toastNotification">
          <div className="toastIcon">
            <Icons.Check />
          </div>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

function NotificationSettingsModal({ enabled, trouble, maintenance, busy, onEnable, onToggleTrouble, onToggleMaintenance, onClose }) {
  return (
    <div className="modalOverlay notificationModalOverlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="notificationSettingsCard">
        <div className="notificationSettingsHeader">
          <div className="notificationSettingsIcon"><Icons.Bell /></div>
          <div>
            <h3>Notifikasi Monitoring</h3>
            <p>Dapatkan peringatan meskipun website sedang tidak dibuka.</p>
          </div>
          <button type="button" className="modalCloseBtn" onClick={onClose}>×</button>
        </div>

        <div className={`notificationStatusCard ${enabled ? 'active' : ''}`}>
          <div>
            <b>{enabled ? 'Notifikasi aktif' : 'Notifikasi belum aktif'}</b>
            <span>{enabled ? 'Notifikasi browser aktif. Peringatan muncul saat aplikasi/PWA sedang aktif.' : 'Aktifkan izin notifikasi browser terlebih dahulu.'}</span>
          </div>
          <button type="button" className="btnPrimary" onClick={onEnable} disabled={busy}>
            <Icons.Bell />
            <span>{busy ? 'Mengaktifkan...' : enabled ? 'Perbarui Perangkat' : 'Aktifkan Notifikasi'}</span>
          </button>
        </div>

        <div className="notificationOptions">
          <label className="notificationOption">
            <span><b>Aset Trouble / Rusak</b><small>Beritahu saat perangkat berubah menjadi Rusak.</small></span>
            <input type="checkbox" checked={trouble} onChange={e => onToggleTrouble(e.target.checked)} />
          </label>
          <label className="notificationOption">
            <span><b>Aset Maintenance</b><small>Beritahu saat ada perangkat masuk maintenance atau catatan servis baru.</small></span>
            <input type="checkbox" checked={maintenance} onChange={e => onToggleMaintenance(e.target.checked)} />
          </label>
        </div>

        <div className="notificationSettingsNote">
          Push notification membutuhkan izin browser dan koneksi HTTPS. Mode ini gratis tanpa Environment Variables. Browser perlu tetap aktif/menjalankan PWA agar perubahan Firestore dapat dipantau.
        </div>

        <div className="modalFooter">
          <button type="button" className="btnLight" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN STATUS CHIP
// ==========================================
function StatusChip({ status }) {
  const s = status || 'Aktif';
  const cls = s.toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`statusChip ${cls}`}>
      <span className="statusDotInner" />
      {s}
    </span>
  );
}

function ConditionChip({ condition }) {
  const c = condition || 'Baik';
  const cls = c.toLowerCase();
  return <span className={`conditionChip ${cls}`}>{c}</span>;
}

// ==========================================
// KOMPONEN LOGIN
// ==========================================
function LoginView({ username, pass, setUsername, setPass, showPass, setShowPass, onLogin }) {
  return (
    <div className="loginContainer">
      <div className="loginPatternBg" />
      <div className="loginGlowOrb orbTop" />
      <div className="loginGlowOrb orbBottom" />

      <div className="loginCard">
        <div className="loginHeader">
          <div className="loginLogosRow">
            <ClickableLogo src={pemkabFullLogo} alt="Pemerintah Kabupaten Batang" className="loginFullLogoImg" wrapperClassName="loginFullLogoBox" />
            <ClickableLogo src={diskominfoLogo} alt="Diskominfo Batang" className="loginDiskominfoImg" wrapperClassName="loginDiskominfoBox" />
          </div>

          <div className="loginBadges">
            <span className="loginGovBadge">PORTAL RESMI SPBE</span>
          </div>
          <h1 className="loginTitle">IT Asset Management</h1>
          <p className="loginSubtitle">Dinas Komunikasi dan Informatika Kabupaten Batang</p>
        </div>

        <form className="loginForm" onSubmit={onLogin}>
          <label className="inputGroup">
            <span className="inputLabel">Username</span>
            <div className="inputFieldWrap">
              <input
                type="text"
                placeholder="Masukkan username"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
          </label>

          <label className="inputGroup">
            <span className="inputLabel">Password</span>
            <div className="inputFieldWrap passwordWrap">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Masukkan password"
                autoComplete="current-password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                required
              />
              <button
                type="button"
                className="togglePassBtn"
                onClick={() => setShowPass(!showPass)}
                title={showPass ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
              >
                {showPass ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
            </div>
          </label>

          <button type="submit" className="btnPrimary loginSubmitBtn">
            <span>Masuk ke Sistem</span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        <div className="loginFooter">
          <span>Hak Cipta © 2026 Pemerintah Kabupaten Batang</span>
          <span>Dinas Komunikasi dan Informatika</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN DASHBOARD
// ==========================================
function DashboardView({ counts, assets, maint, aiAlerts, setSelected, go, openAdd }) {
  const pct = n => (counts.total ? Math.round((n / counts.total) * 100) : 0);

  // Kategori terbanyak
  const catStats = useMemo(() => {
    const map = {};
    assets.forEach(a => {
      map[a.kategori] = (map[a.kategori] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [assets]);

  return (
    <div className="dashboardContainer">
      {/* BANNER UTAMA */}
      <section className="welcomeBanner">
        <div className="welcomeContent">
          <div className="welcomeEyebrow">
            <Icons.ShieldCheck />
            <span>SISTEM INFORMASI ASET TIK DAERAH</span>
          </div>
          <h2>
            Selamat datang di <b>IT Asset Management</b>
          </h2>
          <p>
            Pusat pengendalian dan inventarisasi perangkat teknologi informasi Pemerintah Kabupaten Batang.
            Mendukung akuntabilitas tata kelola BMN/BMD sektor SPBE secara tertib dan transparan.
          </p>

          <div className="welcomeActions">
            <button className="btnPrimary" onClick={openAdd}>
              <Icons.Plus />
              <span>Tambah Aset Baru</span>
            </button>
            <button className="btnLight" onClick={() => go('inventaris')}>
              <Icons.Box />
              <span>Buka Inventaris</span>
            </button>
            <button className="btnLight" onClick={() => go('laporan')}>
              <Icons.FileText />
              <span>Rekap Laporan</span>
            </button>
          </div>
        </div>

        <div className="welcomeGovBadge">
          <div className="govBadgeCard fullLogoCard">
            <div className="govFullLogoWrap" title="Pemerintah Kabupaten Batang">
              <ClickableLogo src={pemkabFullLogo} alt="Pemerintah Kabupaten Batang" className="govFullLogoImg" />
            </div>
            <div className="govCardSub">
              <div className="govDiskominfoWrap" title="Dinas Komunikasi dan Informatika">
                <img src={diskominfoLogo} alt="Diskominfo" className="govDiskominfoMini" />
              </div>
              <div className="govCardInfo">
                <b>DISKOMINFO KAB. BATANG</b>
                <span className="liveIndicator">
                  <span className="liveDot" /> Sistem Beroperasi Normal
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SMART TROUBLE MONITOR */}
      <section className="smartMonitorCard">
        <div className="smartMonitorHead">
          <div>
            <span className="smartEyebrow">SMART ASSET MONITOR</span>
            <h3>Deteksi Trouble Otomatis</h3>
            <p>Menganalisis kondisi, status, keterangan, dan riwayat maintenance tanpa layanan AI berbayar.</p>
          </div>
          <div className={`smartStatus ${aiAlerts.length ? 'danger' : 'ok'}`}>
            <span className="smartPulse" /> {aiAlerts.length ? `${aiAlerts.length} indikasi perlu dicek` : 'Semua terpantau normal'}
          </div>
        </div>
        {aiAlerts.length ? (
          <div className="smartAlertList">
            {aiAlerts.map(({ asset, score, reasons }) => (
              <button key={asset.id} type="button" className="smartAlertItem" onClick={() => setSelected(asset)}>
                <span className="smartScore">{score}%</span>
                <span className="smartAlertText"><b>{asset.nama}</b><small>{reasons.slice(0,2).join(' • ')}</small></span>
                <span className="smartArrow">›</span>
              </button>
            ))}
          </div>
        ) : <div className="smartEmpty">Belum ada indikasi trouble berdasarkan data aset saat ini.</div>}
      </section>

      {/* STATS CARDS */}
      <div className="statsGrid">
        <div className="statCard cardTotal" onClick={() => go('inventaris')}>
          <div className="statCardTop">
            <span className="statLabel">Total Aset IT</span>
            <div className="statIconBox"><Icons.Box /></div>
          </div>
          <div className="statValue">{counts.total}</div>
          <div className="statFooter">
            <span>Perangkat terdata dalam sistem</span>
          </div>
        </div>

        <div className="statCard cardActive" onClick={() => go('inventaris')}>
          <div className="statCardTop">
            <span className="statLabel">Perangkat Aktif</span>
            <div className="statIconBox"><Icons.Check /></div>
          </div>
          <div className="statValue">{counts.aktif}</div>
          <div className="statFooter">
            <span className="statBadgePositive">{pct(counts.aktif)}% Beroperasi</span>
            <span className="statSub">kondisi normal</span>
          </div>
        </div>

        <div className="statCard cardMaint" onClick={() => go('maintenance')}>
          <div className="statCardTop">
            <span className="statLabel">Dalam Pemeliharaan</span>
            <div className="statIconBox"><Icons.Wrench /></div>
          </div>
          <div className="statValue">{counts.maint}</div>
          <div className="statFooter">
            <span className="statBadgeWarning">{pct(counts.maint)}% Sedang Servis</span>
            <span className="statSub">perlu tindakan</span>
          </div>
        </div>

        <div className="statCard cardBroken" onClick={() => go('inventaris')}>
          <div className="statCardTop">
            <span className="statLabel">Kondisi Rusak</span>
            <div className="statIconBox"><Icons.Trash /></div>
          </div>
          <div className="statValue">{counts.rusak}</div>
          <div className="statFooter">
            <span className="statBadgeDanger">{pct(counts.rusak)}% Afkir / Rusak</span>
            <span className="statSub">rekomendasi ganti</span>
          </div>
        </div>
      </div>

      {/* DASHBOARD PANELS (2 KOLOM) */}
      <div className="dashGridCols">
        {/* PANEL STATUS & DISTRIBUSI */}
        <div className="dashPanel">
          <div className="panelHeader">
            <div>
              <h2 className="panelTitle">Distribusi Status Perangkat</h2>
              <p className="panelSubtitle">Perbandingan status operasional saat ini</p>
            </div>
            <button className="btnLink" onClick={() => go('inventaris')}>
              Kelola →
            </button>
          </div>

          <div className="statusBarList">
            {[
              { label: 'Aktif / Operasional', count: counts.aktif, colorClass: 'barActive' },
              { label: 'Maintenance / Servis', count: counts.maint, colorClass: 'barMaint' },
              { label: 'Rusak / Afkir', count: counts.rusak, colorClass: 'barBroken' },
              { label: 'Tidak Digunakan (Cadangan)', count: counts.idle, colorClass: 'barIdle' }
            ].map(item => {
              const widthPct = counts.total ? (item.count / counts.total) * 100 : 0;
              return (
                <div className="statusBarItem" key={item.label}>
                  <div className="statusBarMeta">
                    <span className="barLabel">{item.label}</span>
                    <span className="barCount">
                      <b>{item.count}</b> unit ({Math.round(widthPct)}%)
                    </span>
                  </div>
                  <div className="barTrack">
                    <div
                      className={`barFill ${item.colorClass}`}
                      style={{ width: `${Math.max(item.count ? 4 : 0, widthPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="categoryTagCloud">
            <span className="tagCloudTitle">Kategori Terdaftar:</span>
            <div className="tagList">
              {catStats.slice(0, 6).map(([cat, cnt]) => (
                <span className="categoryChip" key={cat}>
                  {cat} <b>{cnt}</b>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL PERANGKAT TERBARU */}
        <div className="dashPanel">
          <div className="panelHeader">
            <div>
              <h2 className="panelTitle">Aset Terbaru Terdaftar</h2>
              <p className="panelSubtitle">Perangkat yang baru diinventarisasi</p>
            </div>
            <button className="btnLink" onClick={() => go('inventaris')}>
              Lihat Semua →
            </button>
          </div>

          <div className="recentList">
            {assets.slice(0, 5).map(a => (
              <div className="recentRow" key={a.id} onClick={() => setSelected(a)}>
                <div className="recentThumb">
                  {a.fotoUrl ? (
                    <img src={a.fotoUrl} alt={a.nama} />
                  ) : (
                    <div className="thumbPlaceholder">{a.kategori?.slice(0, 2).toUpperCase()}</div>
                  )}
                </div>
                <div className="recentDetails">
                  <b className="recentName">{a.nama}</b>
                  <div className="recentMeta">
                    <span className="recentCode">{a.kodeAset}</span>
                    <span className="recentLoc">
                      <Icons.MapPin /> <MapsLink location={a.lokasi}>{a.lokasi || 'Lokasi belum diisi'}</MapsLink>
                    </span>
                  </div>
                </div>
                <StatusChip status={a.status} />
              </div>
            ))}

            {!assets.length && (
              <div className="emptyStateSmall">Belum ada perangkat yang terdaftar di sistem.</div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK INFO STRIP */}
      <div className="infoBanner">
        <div className="infoBannerIcon"><Icons.ShieldCheck /></div>
        <div className="infoBannerText">
          <b>Standardisasi Pengelolaan Aset TIK SPBE</b>
          <p>
            Pastikan setiap perangkat baru diberi label stiker kode aset resmi dan dicek berkala minimal setiap semester
            untuk menjaga keberlangsungan layanan publik Diskominfo Kabupaten Batang.
          </p>
        </div>
        <button className="btnPrimary outline" onClick={() => go('maintenance')}>
          <Icons.Wrench />
          <span>Jadwal Servis</span>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN INVENTARIS
// ==========================================
function InventoryView({
  assets,
  totalCount,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  catFilter,
  setCatFilter,
  condFilter,
  setCondFilter,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  openEdit,
  removeAsset,
  onOpenDetail,
  openAdd
}) {
  return (
    <div className="inventoryContainer">
      {/* FILTER & TOOLBAR */}
      <div className="inventoryToolbar">
        <div className="searchBox">
          <Icons.Search />
          <input
            type="text"
            placeholder="Cari kode aset, nama perangkat, lokasi, merk, IP Address..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="clearSearchBtn" onClick={() => setSearch('')} title="Hapus pencarian">
              ×
            </button>
          )}
        </div>

        <div className="filterControls">
          <div className="filterGroup">
            <span className="filterLabel">Kategori:</span>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="Semua">Semua Kategori</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="filterGroup">
            <span className="filterLabel">Status:</span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="Semua">Semua Status</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="filterGroup">
            <span className="filterLabel">Kondisi:</span>
            <select value={condFilter} onChange={e => setCondFilter(e.target.value)}>
              <option value="Semua">Semua Kondisi</option>
              {CONDITIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="filterGroup">
            <span className="filterLabel">Urutkan:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Terbaru Ditambahkan</option>
              <option value="name-asc">Nama (A - Z)</option>
              <option value="name-desc">Nama (Z - A)</option>
              <option value="code">Kode Aset</option>
            </select>
          </div>

          <div className="viewModeSwitch">
            <button
              className={`viewBtn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Tampilan Kartu (Grid)"
            >
              <Icons.Grid />
            </button>
            <button
              className={`viewBtn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Tampilan Tabel (List)"
            >
              <Icons.List />
            </button>
          </div>
        </div>
      </div>

      <div className="inventoryResultsBar">
        <span>
          Menampilkan <b>{assets.length}</b> dari total <b>{totalCount}</b> perangkat
        </span>
        {(search || statusFilter !== 'Semua' || catFilter !== 'Semua' || condFilter !== 'Semua') && (
          <button
            className="resetFilterBtn"
            onClick={() => {
              setSearch('');
              setStatusFilter('Semua');
              setCatFilter('Semua');
              setCondFilter('Semua');
            }}
          >
            Reset Semua Filter
          </button>
        )}
      </div>

      {/* GRID VIEW */}
      {viewMode === 'grid' ? (
        <div className="assetsGrid">
          {assets.map(a => (
            <div className="assetCard" key={a.id}>
              <div className="cardMedia" onClick={() => onOpenDetail(a)}>
                {a.fotoUrl ? (
                  <img src={a.fotoUrl} alt={a.nama} className="cardImg" />
                ) : (
                  <div className="cardImgFallback">
                    <Icons.Box />
                    <span>{a.kategori}</span>
                  </div>
                )}
                <div className="cardTopBadges">
                  <span className="categoryBadge">{a.kategori}</span>
                  <StatusChip status={a.status} />
                </div>
              </div>

              <div className="cardBody">
                <div className="cardTitleRow" onClick={() => onOpenDetail(a)}>
                  <h3 className="cardTitle" title={a.nama}>
                    {a.nama || 'Tanpa Nama'}
                  </h3>
                </div>

                <div className="cardSpecs">
                  <div className="specItem">
                    <span className="specKey">Kode:</span>
                    <span className="specVal codeVal">{a.kodeAset}</span>
                  </div>
                  <div className="specItem">
                    <span className="specKey">Merk/Model:</span>
                    <span className="specVal">
                      {[a.merk, a.model].filter(Boolean).join(' ') || '-'}
                    </span>
                  </div>
                  {a.ipAddress && (
                    <div className="specItem">
                      <span className="specKey">IP:</span>
                      <span className="specVal ipVal">{a.ipAddress}</span>
                    </div>
                  )}
                  <div className="specItem">
                    <span className="specKey">Lokasi:</span>
                    <span className="specVal">
                      <Icons.MapPin /> <MapsLink location={a.lokasi}>{a.lokasi || 'Belum diisi'}</MapsLink>
                    </span>
                  </div>
                </div>

                <div className="cardFooter">
                  <ConditionChip condition={a.kondisi} />
                  <div className="cardActions">
                    <button
                      className="btnCardAction"
                      onClick={() => onOpenDetail(a)}
                      title="Lihat Detail & QR"
                    >
                      <Icons.Eye />
                      <span>Detail</span>
                    </button>
                    <button
                      className="btnCardAction"
                      onClick={() => openEdit(a)}
                      title="Edit Perangkat"
                    >
                      <Icons.Edit />
                    </button>
                    <button
                      className="btnCardAction danger"
                      onClick={() => removeAsset(a.id)}
                      title="Hapus Perangkat"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!assets.length && (
            <div className="emptyStateBox">
              <div className="emptyIcon"><Icons.Box /></div>
              <h3>Tidak ada perangkat yang sesuai</h3>
              <p>Coba sesuaikan kata kunci pencarian atau bersihkan filter yang aktif.</p>
              <button className="btnPrimary" onClick={openAdd}>
                <Icons.Plus />
                <span>Tambah Perangkat Baru</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="tableCard">
          <div className="tableScroll">
            <table className="inventoryTable">
              <thead>
                <tr>
                  <th>Kode Aset</th>
                  <th>Nama Perangkat</th>
                  <th>Kategori</th>
                  <th>Merk / Model</th>
                  <th>IP / MAC Address</th>
                  <th>Lokasi</th>
                  <th>Kondisi</th>
                  <th>Status</th>
                  <th className="textRight">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id}>
                    <td>
                      <b className="codeVal">{a.kodeAset}</b>
                    </td>
                    <td>
                      <div className="tableDeviceCell" onClick={() => onOpenDetail(a)}>
                        <div className="tableDeviceThumb">
                          {a.fotoUrl ? (
                            <img src={a.fotoUrl} alt="" />
                          ) : (
                            <span>{a.kategori?.slice(0, 2)}</span>
                          )}
                        </div>
                        <div>
                          <b className="tableDeviceName">{a.nama}</b>
                          {a.serialNumber && (
                            <span className="tableDeviceSn">S/N: {a.serialNumber}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{a.kategori}</td>
                    <td>{[a.merk, a.model].filter(Boolean).join(' ') || '-'}</td>
                    <td>
                      <div className="networkCell">
                        {a.ipAddress && <span className="ipVal">{a.ipAddress}</span>}
                        {a.macAddress && <span className="macVal">{a.macAddress}</span>}
                        {!a.ipAddress && !a.macAddress && <span className="textMuted">-</span>}
                      </div>
                    </td>
                    <td>
                      <span className="locText">
                        <Icons.MapPin /> <MapsLink location={a.lokasi}>{a.lokasi || '-'}</MapsLink>
                      </span>
                    </td>
                    <td>
                      <ConditionChip condition={a.kondisi} />
                    </td>
                    <td>
                      <StatusChip status={a.status} />
                    </td>
                    <td className="textRight">
                      <div className="tableActionBtns">
                        <button
                          className="btnMini"
                          onClick={() => onOpenDetail(a)}
                          title="Lihat Detail & QR"
                        >
                          <Icons.Eye />
                        </button>
                        <button
                          className="btnMini"
                          onClick={() => openEdit(a)}
                          title="Edit Perangkat"
                        >
                          <Icons.Edit />
                        </button>
                        <button
                          className="btnMini danger"
                          onClick={() => removeAsset(a.id)}
                          title="Hapus Perangkat"
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!assets.length && (
                  <tr>
                    <td colSpan={9} className="tableEmpty">
                      Belum ada data perangkat yang cocok dengan kriteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// KOMPONEN FORM INPUT PERANGKAT
// ==========================================
function AssetFormView({ form, setForm, saveAsset, loading, editing, cancel }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Upload foto perangkat dengan kompresi client-side (100% jalan di lokal & production)
  async function handlePhotoFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('Ukuran foto terlalu besar. Maksimal ukuran foto adalah 8 MB.');
      return;
    }

    setUploading(true);

    try {
      // 1. Coba upload ke endpoint /api/upload terlebih dahulu
      let uploadedUrl = '';
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'content-type': file.type || 'application/octet-stream' },
          body: file
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) uploadedUrl = data.url;
        }
      } catch (err) {
        console.info('Endpoint /api/upload tidak tersedia di server lokal, beralih ke kompresi client:', err);
      }

      if (!uploadedUrl) {
        throw new Error('Upload foto memerlukan endpoint Vercel Blob. Deploy project ke Vercel dan pastikan BLOB_READ_WRITE_TOKEN sudah dibuat.');
      }

      setForm(prev => ({ ...prev, fotoUrl: uploadedUrl }));
    } catch (e) {
      alert('Gagal memproses gambar: ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setForm(prev => ({ ...prev, fotoUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="formContainer">
      <form className="assetFormCard" onSubmit={saveAsset}>
        <div className="formHeader">
          <div>
            <span className="formEyebrow">FORMULIR INVENTARIS</span>
            <h2 className="formTitleText">{editing ? 'Perbarui Data Perangkat' : 'Tambah Perangkat Baru'}</h2>
            <p className="formSubtitle">Pastikan seluruh data teknis dan identitas fisik diisi secara lengkap dan akurat.</p>
          </div>
          <span className="formReqHint">* Menandakan kolom wajib diisi</span>
        </div>

        <div className="formGrid">
          <label className="formField">
            <span className="fieldLabel">
              Kode Aset (Inventaris BMD) <em>*</em>
            </span>
            <input
              type="text"
              required
              placeholder="Contoh: AST-BTG-2026-009"
              value={form.kodeAset}
              onChange={e => setForm({ ...form, kodeAset: e.target.value })}
            />
            <span className="fieldHelper">Kode barcode unik penanda barang milik daerah</span>
          </label>

          <label className="formField">
            <span className="fieldLabel">
              Nama Perangkat <em>*</em>
            </span>
            <input
              type="text"
              required
              placeholder="Contoh: Core Switch Cisco Catalyst 3850"
              value={form.nama}
              onChange={e => setForm({ ...form, nama: e.target.value })}
            />
            <span className="fieldHelper">Nama lengkap perangkat keras atau nama fungsional</span>
          </label>

          <label className="formField">
            <span className="fieldLabel">Kategori Perangkat <em>*</em></span>
            <select
              value={form.kategori}
              onChange={e => setForm({ ...form, kategori: e.target.value })}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="formField">
            <span className="fieldLabel">Merk / Brand</span>
            <input
              type="text"
              placeholder="Contoh: Cisco, HP, Dell, Mikrotik, Hikvision"
              value={form.merk}
              onChange={e => setForm({ ...form, merk: e.target.value })}
            />
          </label>

          <label className="formField">
            <span className="fieldLabel">Tipe / Model</span>
            <input
              type="text"
              placeholder="Contoh: PowerEdge R740 / ProOne 440 G9"
              value={form.model}
              onChange={e => setForm({ ...form, model: e.target.value })}
            />
          </label>

          <label className="formField">
            <span className="fieldLabel">Nomor Seri (Serial Number)</span>
            <input
              type="text"
              placeholder="Contoh: FOC2134S0AB"
              value={form.serialNumber}
              onChange={e => setForm({ ...form, serialNumber: e.target.value })}
            />
          </label>

          <label className="formField">
            <span className="fieldLabel">IP Address (Jika Ada)</span>
            <input
              type="text"
              placeholder="Contoh: 10.10.1.1 atau 192.168.1.10"
              value={form.ipAddress}
              onChange={e => setForm({ ...form, ipAddress: e.target.value })}
            />
          </label>

          <label className="formField">
            <span className="fieldLabel">MAC Address (Jika Ada)</span>
            <input
              type="text"
              placeholder="Contoh: 00:1A:2B:3C:4D:5E"
              value={form.macAddress}
              onChange={e => setForm({ ...form, macAddress: e.target.value })}
            />
          </label>

          <div className="formField fullWidth">
            <span className="fieldLabel">Lokasi / Ruangan Penempatan</span>
            <LocationPicker
              value={form.lokasi}
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={loc => setForm({ ...form, ...loc })}
            />
          </div>

          <label className="formField">
            <span className="fieldLabel">Kondisi Fisik</span>
            <select
              value={form.kondisi}
              onChange={e => setForm({ ...form, kondisi: e.target.value })}
            >
              {CONDITIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="formField">
            <span className="fieldLabel">Status Operasional</span>
            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          {/* FOTO UPLOAD */}
          <div className="formField fullWidth">
            <span className="fieldLabel">Foto Perangkat</span>
            <div className="photoUploadArea">
              {form.fotoUrl ? (
                <div className="photoPreviewCard">
                  <img src={form.fotoUrl} alt="Pratinjau perangkat" className="photoPreviewImg" />
                  <div className="photoPreviewActions">
                    <button type="button" className="btnLight btnSmall" onClick={() => fileInputRef.current?.click()}>
                      Ganti Foto
                    </button>
                    <button type="button" className="btnDanger btnSmall" onClick={removePhoto}>
                      Hapus Foto
                    </button>
                  </div>
                </div>
              ) : (
                <div className="uploadDropzone" onClick={() => fileInputRef.current?.click()}>
                  <div className="uploadIconWrap">
                    <Icons.Box />
                  </div>
                  <b>Pilih Foto Perangkat</b>
                  <span>Format JPG, PNG, WebP (Maksimal 8 MB)</span>
                  <button type="button" className="btnLight btnSmall uploadTriggerBtn" disabled={uploading}>
                    {uploading ? 'Mengunggah Foto...' : 'Pilih dari File / Kamera'}
                  </button>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoFile}
              />
            </div>
          </div>

          <label className="formField fullWidth">
            <span className="fieldLabel">Keterangan / Catatan Spesifikasi</span>
            <textarea
              rows={4}
              placeholder="Tuliskan catatan teknis tambahan, vendor pengadaan, lisensi, atau riwayat garansi..."
              value={form.keterangan}
              onChange={e => setForm({ ...form, keterangan: e.target.value })}
            />
          </label>
        </div>

        <div className="formFooterActions">
          <button type="button" className="btnLight" onClick={cancel}>
            Batal
          </button>
          <button type="submit" className="btnPrimary" disabled={loading || uploading}>
            <Icons.Check />
            <span>{loading ? 'Menyimpan Data...' : editing ? 'Simpan Perubahan' : 'Simpan Perangkat'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// MODAL DETAIL ASET
// ==========================================
function DetailModal({ asset, maintList, closeModal, onEdit, onDelete, addMaintenanceRecord, onPrintLabel }) {
  const [activeTab, setActiveTab] = useState('specs'); // 'specs' | 'maintenance' | 'qr'
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  function copyText(text, key) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  function handleQuickMaintSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newStatus = f.get('updateStatus') || '';

    addMaintenanceRecord(
      {
        tanggal: f.get('tanggal'),
        teknisi: f.get('teknisi'),
        keluhan: f.get('keluhan'),
        tindakan: f.get('tindakan'),
        hasil: f.get('hasil')
      },
      asset.id,
      newStatus
    );

    e.currentTarget.reset();
    setShowAddMaint(false);
  }

  const qrTargetUrl = `${window.location.origin}${window.location.pathname}#asset=${asset.id}`;

  return (
    <div className="modalOverlay" onMouseDown={e => e.target === e.currentTarget && closeModal()}>
      <div className="modalContainer">
        <div className="modalHeader">
          <div className="modalHeaderLeft">
            <span className="modalEyebrow">DETAIL INVENTARIS ASET TIK</span>
            <h2 className="modalTitle">{asset.nama}</h2>
            <div className="modalTags">
              <span className="codePill">{asset.kodeAset}</span>
              <span className="catPill">{asset.kategori}</span>
              <StatusChip status={asset.status} />
              <ConditionChip condition={asset.kondisi} />
            </div>
          </div>
          <button className="modalCloseBtn" onClick={closeModal} title="Tutup Modal">
            ×
          </button>
        </div>

        {/* TAB NAVIGATION */}
        <div className="modalTabs">
          <button
            className={`tabBtn ${activeTab === 'specs' ? 'active' : ''}`}
            onClick={() => setActiveTab('specs')}
          >
            Spesifikasi Teknis
          </button>
          <button
            className={`tabBtn ${activeTab === 'maintenance' ? 'active' : ''}`}
            onClick={() => setActiveTab('maintenance')}
          >
            Riwayat Servis ({maintList.length})
          </button>
          <button
            className={`tabBtn ${activeTab === 'qr' ? 'active' : ''}`}
            onClick={() => setActiveTab('qr')}
          >
            QR Code & Label
          </button>
        </div>

        <div className="modalBody">
          {activeTab === 'specs' && (
            <div className="specsTabContent">
              <div className="specHeroRow">
                <div className="specMediaBox">
                  {asset.fotoUrl ? (
                    <img src={asset.fotoUrl} alt={asset.nama} className="specHeroImg" />
                  ) : (
                    <div className="specHeroFallback">
                      <Icons.Box />
                      <span>{asset.kategori}</span>
                    </div>
                  )}
                </div>

                <div className="specQuickCards">
                  <div className="quickCard">
                    <span className="qKey">Lokasi Penempatan</span>
                    <b className="qVal">
                      <Icons.MapPin /> <MapsLink location={asset.lokasi}>{asset.lokasi || 'Belum Ditentukan'}</MapsLink>
                    </b>
                  </div>
                  <div className="quickCard">
                    <span className="qKey">Merk & Model</span>
                    <b className="qVal">{[asset.merk, asset.model].filter(Boolean).join(' ') || '-'}</b>
                  </div>
                  <div className="quickCard">
                    <span className="qKey">Kondisi Fisik</span>
                    <b className="qVal">{asset.kondisi}</b>
                  </div>
                  <div className="quickCard">
                    <span className="qKey">Status Operasi</span>
                    <b className="qVal">{asset.status}</b>
                  </div>
                </div>
              </div>

              <div className="detailLocationMapPanel">
                <div className="detailLocationMapHeader">
                  <div>
                    <span className="qKey">Peta Lokasi Perangkat</span>
                    <b>{asset.lokasi || 'Lokasi belum ditentukan'}</b>
                  </div>
                  <MapsLink location={asset.lokasi} latitude={asset.latitude} longitude={asset.longitude}>Buka di Google Maps</MapsLink>
                </div>
                <GoogleMapPreview location={asset.lokasi} latitude={asset.latitude} longitude={asset.longitude} />
              </div>

              <div className="specDetailGrid">
                <div className="specGridItem">
                  <span className="sgLabel">Nomor Seri (Serial Number)</span>
                  <div className="sgValueCopy">
                    <b>{asset.serialNumber || '-'}</b>
                    {asset.serialNumber && (
                      <button
                        className="copyBtn"
                        onClick={() => copyText(asset.serialNumber, 'sn')}
                        title="Salin Nomor Seri"
                      >
                        <Icons.Copy />
                        <span>{copiedKey === 'sn' ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="specGridItem">
                  <span className="sgLabel">IP Address</span>
                  <div className="sgValueCopy">
                    <b className="ipVal">{asset.ipAddress || '-'}</b>
                    {asset.ipAddress && (
                      <button
                        className="copyBtn"
                        onClick={() => copyText(asset.ipAddress, 'ip')}
                        title="Salin IP"
                      >
                        <Icons.Copy />
                        <span>{copiedKey === 'ip' ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="specGridItem">
                  <span className="sgLabel">MAC Address</span>
                  <div className="sgValueCopy">
                    <b className="macVal">{asset.macAddress || '-'}</b>
                    {asset.macAddress && (
                      <button
                        className="copyBtn"
                        onClick={() => copyText(asset.macAddress, 'mac')}
                        title="Salin MAC"
                      >
                        <Icons.Copy />
                        <span>{copiedKey === 'mac' ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="specGridItem">
                  <span className="sgLabel">Terakhir Diperbarui</span>
                  <b>
                    {asset.updatedAt
                      ? new Date(asset.updatedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Terdata di sistem'}
                  </b>
                </div>

                <div className="specGridItem fullSpan">
                  <span className="sgLabel">Keterangan & Catatan Teknis</span>
                  <p className="sgDesc">{asset.keterangan || 'Tidak ada catatan khusus untuk perangkat ini.'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="maintTabContent">
              <div className="maintTabHeader">
                <div>
                  <h3 className="subSectionTitle">Log Pemeliharaan & Servis</h3>
                  <p className="subSectionDesc">Pencatatan riwayat kerusakan, perbaikan teknisi, dan hasil uji coba.</p>
                </div>
                <button
                  className="btnPrimary btnSmall"
                  onClick={() => setShowAddMaint(!showAddMaint)}
                >
                  <Icons.Plus />
                  <span>{showAddMaint ? 'Tutup Formulir' : 'Catat Pemeliharaan'}</span>
                </button>
              </div>

              {showAddMaint && (
                <form className="quickMaintForm" onSubmit={handleQuickMaintSubmit}>
                  <h4>Tambah Catatan Pemeliharaan Baru</h4>
                  <div className="maintFormGrid">
                    <label>
                      <span>Tanggal Pelaksanaan *</span>
                      <input
                        type="date"
                        name="tanggal"
                        required
                        defaultValue={new Date().toISOString().split('T')[0]}
                      />
                    </label>
                    <label>
                      <span>Nama Teknisi / Petugas *</span>
                      <input type="text" name="teknisi" required placeholder="Contoh: Budi Santoso" />
                    </label>
                    <label className="fullSpan">
                      <span>Keluhan / Masalah yang Ditemui</span>
                      <textarea
                        name="keluhan"
                        rows={2}
                        placeholder="Deskripsikan kerusakan atau gejala kendala..."
                      />
                    </label>
                    <label className="fullSpan">
                      <span>Tindakan Perbaikan / Solusi</span>
                      <textarea
                        name="tindakan"
                        rows={2}
                        placeholder="Uraikan langkah penanganan teknis yang dilakukan..."
                      />
                    </label>
                    <label>
                      <span>Hasil Akhir / Rekomendasi</span>
                      <input type="text" name="hasil" placeholder="Contoh: Normal, port Gigabit aktif kembali" />
                    </label>
                    <label>
                      <span>Perbarui Status Perangkat Menjadi:</span>
                      <select name="updateStatus" defaultValue={asset.status}>
                        <option value="">Jangan Ubah ({asset.status})</option>
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="quickMaintActions">
                    <button type="button" className="btnLight" onClick={() => setShowAddMaint(false)}>
                      Batal
                    </button>
                    <button type="submit" className="btnPrimary">
                      Simpan Catatan Servis
                    </button>
                  </div>
                </form>
              )}

              <div className="maintTimeline">
                {maintList.map(m => (
                  <div className="timelineCard" key={m.id}>
                    <div className="timelineDot" />
                    <div className="timelineHeader">
                      <div>
                        <span className="timelineDate">
                          <Icons.Clock /> {m.tanggal}
                        </span>
                        <b className="timelineTech">Teknisi: {m.teknisi}</b>
                      </div>
                    </div>
                    <div className="timelineBody">
                      {m.keluhan && (
                        <div className="tlField">
                          <span className="tlKey">Kendala:</span>
                          <span className="tlVal">{m.keluhan}</span>
                        </div>
                      )}
                      {m.tindakan && (
                        <div className="tlField">
                          <span className="tlKey">Tindakan:</span>
                          <span className="tlVal">{m.tindakan}</span>
                        </div>
                      )}
                      {m.hasil && (
                        <div className="tlField">
                          <span className="tlKey">Hasil:</span>
                          <span className="tlVal highlight">{m.hasil}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {!maintList.length && (
                  <div className="emptyStateSmall">
                    Belum ada riwayat pemeliharaan untuk perangkat ini. Klik tombol "Catat Pemeliharaan" di atas untuk menambahkan.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="qrTabContent">
              <div className="qrDisplayCard">
                <div className="qrBox">
                  <QRCodeSVG value={qrTargetUrl} size={180} level="H" includeMargin={true} />
                </div>
                <div className="qrInfo">
                  <h3>Label Kode QR Perangkat</h3>
                  <p>
                    Pindai (scan) kode QR ini dengan kamera ponsel untuk langsung membuka profil teknis perangkat di sistem.
                  </p>
                  <div className="qrUrlSnippet">
                    <code>{qrTargetUrl}</code>
                  </div>
                  <div className="qrActionButtons">
                    <button className="btnPrimary" onClick={onPrintLabel}>
                      <Icons.Printer />
                      <span>Cetak Stiker Label Aset</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modalFooter">
          <div className="modalFooterLeft">
            <button className="btnLight dangerText" onClick={onDelete}>
              <Icons.Trash />
              <span>Hapus Aset</span>
            </button>
          </div>
          <div className="modalFooterRight">
            <button className="btnLight" onClick={onEdit}>
              <Icons.Edit />
              <span>Edit Data</span>
            </button>
            <button className="btnPrimary" onClick={closeModal}>
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MODAL CETAK STIKER LABEL ASET (PRINT LABEL)
// ==========================================
function PrintLabelModal({ asset, pemkabFullLogo, diskominfoLogo, closeModal }) {
  function doPrint() {
    window.print();
  }

  const qrVal = `${window.location.origin}${window.location.pathname}#asset=${asset.id}`;

  return (
    <div className="modalOverlay" onMouseDown={e => e.target === e.currentTarget && closeModal()}>
      <div className="modalContainer labelModal">
        <div className="modalHeader">
          <div>
            <h3 className="modalTitle">Format Stiker Label Barcode/QR</h3>
            <p className="modalSubtitle">Pratinjau label fisik siap cetak untuk ditempel pada unit perangkat.</p>
          </div>
          <button className="modalCloseBtn" onClick={closeModal}>×</button>
        </div>

        <div className="labelPrintPreview">
          <div className="physicalLabelSticker">
            <div className="labelStickerHeader">
              <img src={pemkabFullLogo} alt="Pemerintah Kabupaten Batang" className="labelPemkabFullLogo" />
              <img src={diskominfoLogo} alt="Diskominfo Batang" className="labelDiskominfoMini" />
            </div>

            <div className="labelStickerBody">
              <div className="labelQrCode">
                <QRCodeSVG value={qrVal} size={110} level="M" />
              </div>
              <div className="labelTextContent">
                <div className="labelBigCode">{asset.kodeAset}</div>
                <div className="labelDevName">{asset.nama}</div>
                <div className="labelMetaSmall">
                  <span>Kategori: {asset.kategori}</span>
                  {asset.serialNumber && <span>S/N: {asset.serialNumber}</span>}
                  <span>Lokasi: <MapsLink location={asset.lokasi}>{asset.lokasi || 'Diskominfo'}</MapsLink></span>
                </div>
              </div>
            </div>

            <div className="labelStickerFooter">
              <span>Sistem Manajemen Aset TIK • diskominfo.batangkab.go.id</span>
            </div>
          </div>
        </div>

        <div className="modalFooter">
          <button className="btnLight" onClick={closeModal}>Tutup</button>
          <button className="btnPrimary" onClick={doPrint}>
            <Icons.Printer />
            <span>Cetak Label Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN MAINTENANCE
// ==========================================
function MaintenanceView({
  assets,
  maint,
  selectedAsset,
  setSelectedAsset,
  addMaintenanceRecord,
  removeMaintenanceRecord
}) {
  const [filterAssetId, setFilterAssetId] = useState(selectedAsset?.id || '');

  function handleFormSubmit(e) {
    e.preventDefault();
    if (!filterAssetId) {
      alert('Silakan pilih perangkat yang dilakukan pemeliharaan terlebih dahulu.');
      return;
    }

    const f = new FormData(e.currentTarget);
    const newStatus = f.get('updateStatus') || '';

    addMaintenanceRecord(
      {
        tanggal: f.get('tanggal'),
        teknisi: f.get('teknisi'),
        keluhan: f.get('keluhan'),
        tindakan: f.get('tindakan'),
        hasil: f.get('hasil')
      },
      filterAssetId,
      newStatus
    );

    e.currentTarget.reset();
  }

  const displayedMaint = useMemo(() => {
    if (!filterAssetId) return maint;
    return maint.filter(m => m.assetId === filterAssetId);
  }, [maint, filterAssetId]);

  const activeAssetObj = assets.find(a => a.id === filterAssetId);

  return (
    <div className="maintPageContainer">
      <div className="maintLayoutGrid">
        {/* KOLOM FORM INPUT */}
        <div className="maintFormColumn">
          <div className="dashPanel">
            <div className="panelHeader">
              <div>
                <h2 className="panelTitle">Catat Pemeliharaan</h2>
                <p className="panelSubtitle">Input perbaikan atau perawatan perangkat berkala</p>
              </div>
            </div>

            <form className="maintPageForm" onSubmit={handleFormSubmit}>
              <label className="formField fullWidth">
                <span className="fieldLabel">Pilih Perangkat Terkait *</span>
                <select
                  value={filterAssetId}
                  onChange={e => {
                    setFilterAssetId(e.target.value);
                    const found = assets.find(a => a.id === e.target.value);
                    setSelectedAsset(found || null);
                  }}
                  required
                >
                  <option value="">-- Pilih Perangkat yang Diservis --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.kodeAset}] {a.nama} ({a.status})
                    </option>
                  ))}
                </select>
              </label>

              {activeAssetObj && (
                <div className="selectedAssetSummary">
                  <div className="summaryTop">
                    <b>{activeAssetObj.nama}</b>
                    <StatusChip status={activeAssetObj.status} />
                  </div>
                  <span className="summaryLoc">
                    <Icons.MapPin /> <MapsLink location={activeAssetObj.lokasi}>{activeAssetObj.lokasi || 'Lokasi belum ditentukan'}</MapsLink>
                  </span>
                </div>
              )}

              <div className="formRowTwo">
                <label className="formField">
                  <span className="fieldLabel">Tanggal Perbaikan *</span>
                  <input
                    type="date"
                    name="tanggal"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </label>
                <label className="formField">
                  <span className="fieldLabel">Nama Teknisi / Staf *</span>
                  <input type="text" name="teknisi" required placeholder="Contoh: Budi Santoso" />
                </label>
              </div>

              <label className="formField fullWidth">
                <span className="fieldLabel">Keluhan / Masalah Teknis</span>
                <textarea
                  name="keluhan"
                  rows={2}
                  placeholder="Jelaskan masalah, pesan error, atau alasan servis..."
                />
              </label>

              <label className="formField fullWidth">
                <span className="fieldLabel">Tindakan Penanganan / Solusi</span>
                <textarea
                  name="tindakan"
                  rows={2}
                  placeholder="Jelaskan perbaikan, penggantian suku cadang, atau update yang dilakukan..."
                />
              </label>

              <label className="formField fullWidth">
                <span className="fieldLabel">Hasil Akhir & Rekomendasi</span>
                <input
                  type="text"
                  name="hasil"
                  placeholder="Contoh: Normal, port LAN lancar kembali"
                />
              </label>

              <label className="formField fullWidth">
                <span className="fieldLabel">Perbarui Status Perangkat:</span>
                <select name="updateStatus" defaultValue="Aktif">
                  <option value="">Jangan Ubah Status</option>
                  <option value="Aktif">Ubah jadi "Aktif" (Selesai Servis)</option>
                  <option value="Maintenance">Ubah jadi "Maintenance" (Sedang Dikerjakan)</option>
                  <option value="Rusak">Ubah jadi "Rusak" (Tidak Bisa Diperbaiki)</option>
                  <option value="Tidak Digunakan">Ubah jadi "Tidak Digunakan"</option>
                </select>
              </label>

              <button type="submit" className="btnPrimary fullWidthBtn" disabled={!filterAssetId}>
                <Icons.Check />
                <span>Simpan Riwayat Pemeliharaan</span>
              </button>
            </form>
          </div>
        </div>

        {/* KOLOM LOG RIWAYAT */}
        <div className="maintListColumn">
          <div className="dashPanel">
            <div className="panelHeader">
              <div>
                <h2 className="panelTitle">
                  Riwayat Pemeliharaan {filterAssetId ? '(Perangkat Terpilih)' : '(Seluruh Perangkat)'}
                </h2>
                <p className="panelSubtitle">Total {displayedMaint.length} log servis tercatat</p>
              </div>

              {filterAssetId && (
                <button className="btnLink" onClick={() => setFilterAssetId('')}>
                  Tampilkan Semua
                </button>
              )}
            </div>

            <div className="maintCardsList">
              {displayedMaint.map(m => {
                const targetAsset = assets.find(a => a.id === m.assetId);
                return (
                  <div className="maintHistoryCard" key={m.id}>
                    <div className="mhcTop">
                      <div>
                        <div className="mhcAssetTitle">
                          <b>{targetAsset?.nama || 'Perangkat Terhapus'}</b>
                          <span className="mhcCode">{targetAsset?.kodeAset}</span>
                        </div>
                        <span className="mhcDate">
                          <Icons.Clock /> {m.tanggal} • Oleh: <b>{m.teknisi}</b>
                        </span>
                      </div>
                      <button
                        className="btnDeleteMaint"
                        onClick={() => removeMaintenanceRecord(m.id)}
                        title="Hapus riwayat ini"
                      >
                        <Icons.Trash />
                      </button>
                    </div>

                    <div className="mhcBody">
                      {m.keluhan && (
                        <div className="mhcRow">
                          <span className="mhcKey">Masalah:</span>
                          <span className="mhcVal">{m.keluhan}</span>
                        </div>
                      )}
                      {m.tindakan && (
                        <div className="mhcRow">
                          <span className="mhcKey">Tindakan:</span>
                          <span className="mhcVal">{m.tindakan}</span>
                        </div>
                      )}
                      {m.hasil && (
                        <div className="mhcRow">
                          <span className="mhcKey">Hasil:</span>
                          <span className="mhcVal resultHighlight">{m.hasil}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {!displayedMaint.length && (
                <div className="emptyStateSmall">Belum ada riwayat pemeliharaan yang sesuai filter.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN LAPORAN & REKAP (PRINT KOP SURAT)
// ==========================================
function MonitoringView({ assets, monitorStates, aiAlerts, go }) {
  const monitored = assets.filter(a => a.monitorUrl || a.ipAddress);
  const offline = monitored.filter(a => monitorStates[a.id]?.online === false);
  const online = monitored.filter(a => monitorStates[a.id]?.online === true);
  return (
    <div className="monitorPage">
      <div className="pageIntro">
        <div><span className="smartEyebrow">REAL-TIME ASSET MONITOR</span><h2>Monitoring Perangkat</h2><p>Monitoring LAN berjalan dari komputer agent di jaringan, sehingga pemeriksaan tetap berjalan walaupun website ditutup.</p></div>
        <div className="monitorRefresh">Agent LAN • pemeriksaan setiap 30 detik</div>
      </div>
      <div className="monitorStats"><div><b>{monitored.length}</b><span>Dipantau</span></div><div><b>{online.length}</b><span>Online</span></div><div className={offline.length?'danger':''}><b>{offline.length}</b><span>Indikasi Offline</span></div></div>
      <div className="monitorList">
        {monitored.map(asset => { const st=monitorStates[asset.id]; const ai=analyzeAssetTrouble(asset,[]); const isOff=st?.online===false; return <div className={`monitorRow ${isOff?'isOffline':''}`} key={asset.id}>
          <div className={`monitorDot ${isOff?'offline':st?.online?'online':'pending'}`}></div>
          <div className="monitorMain"><b>{asset.nama}</b><small>{asset.ipAddress || asset.monitorUrl}</small><span>{ai.trouble ? `Indikasi trouble ${ai.score}%` : (isOff ? 'Tidak merespons pemeriksaan' : st?.online ? `Terhubung • ${st.latency || 0} ms` : 'Menunggu pemeriksaan')}</span><small className="monitorSource">{st?.source === 'agent' ? `Agent LAN • ${st?.method || 'monitoring'}` : 'Browser monitor'}</small></div>
          <button className="btnLight" onClick={()=>go('inventaris')}>Lihat aset</button>
        </div>})}
        {!monitored.length && <div className="monitorEmpty">Belum ada perangkat yang memiliki IP Address atau Alamat Monitoring. Tambahkan pada data aset untuk mulai dipantau.</div>}
      </div>
      <div className="monitorNote"><b>Deteksi cerdas:</b> status/kondisi/keterangan aset dianalisis bersama hasil pemeriksaan koneksi. Sistem ini bukan pengganti monitoring jaringan berbasis ICMP/agent; perangkat LAN lokal dapat dibatasi oleh keamanan browser.</div>
    </div>
  );
}

function ReportsView({ assets, counts, pemkabLogo, pemkabFullLogo, diskominfoLogo }) {
  const [reportFilter, setReportFilter] = useState('Semua');

  const filtered = useMemo(() => {
    if (reportFilter === 'Semua') return assets;
    return assets.filter(a => a.status === reportFilter);
  }, [assets, reportFilter]);

  function exportCSV() {
    const headers = [
      'No',
      'Kode Aset',
      'Nama Perangkat',
      'Kategori',
      'Merk',
      'Model',
      'Serial Number',
      'IP Address',
      'MAC Address',
      'Lokasi Penempatan',
      'Kondisi Fisik',
      'Status Operasional',
      'Keterangan'
    ];

    const rows = filtered.map((a, i) => [
      i + 1,
      a.kodeAset,
      a.nama,
      a.kategori,
      a.merk,
      a.model,
      a.serialNumber,
      a.ipAddress,
      a.macAddress,
      a.lokasi,
      a.kondisi,
      a.status,
      a.keterangan
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    // UTF-8 BOM agar terbaca sempurna di Microsoft Excel
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `Laporan_Aset_IT_Diskominfo_Batang_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  const printDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="reportsPageContainer">
      {/* TOOLBAR LAPORAN (NON-PRINT) */}
      <div className="reportsToolbar noPrint">
        <div className="reportsToolbarLeft">
          <div className="filterGroup">
            <span className="filterLabel">Saring Status:</span>
            <select value={reportFilter} onChange={e => setReportFilter(e.target.value)}>
              <option value="Semua">Semua Perangkat ({counts.total})</option>
              <option value="Aktif">Hanya Aktif ({counts.aktif})</option>
              <option value="Maintenance">Dalam Maintenance ({counts.maint})</option>
              <option value="Rusak">Kondisi Rusak ({counts.rusak})</option>
              <option value="Tidak Digunakan">Tidak Digunakan ({counts.idle})</option>
            </select>
          </div>
        </div>

        <div className="reportsToolbarRight">
          <button className="btnLight" onClick={exportCSV}>
            <Icons.Download />
            <span>Ekspor Excel / CSV</span>
          </button>
          <button className="btnPrimary" onClick={printReport}>
            <Icons.Printer />
            <span>Cetak Dokumen Resmi / PDF</span>
          </button>
        </div>
      </div>

      {/* DOKUMEN CETAK RESMI (STANDAR PEMKAB BATANG) */}
      <div className="printableDocumentCard">
        {/* KOP SURAT RESMI */}
        <div className="officialKopSurat">
          <img src={pemkabLogo} alt="Lambang Kabupaten Batang" className="kopEmblemBatang" />
          <div className="kopHeaderText">
            <h3>PEMERINTAH KABUPATEN BATANG</h3>
            <h2>DINAS KOMUNIKASI DAN INFORMATIKA</h2>
            <p className="kopAddress">
              Jl. RA. Kartini No. 1, Kauman, Kec. Batang, Kabupaten Batang, Jawa Tengah 51215
            </p>
            <p className="kopContact">
              Telepon: (0285) 391060 • Laman: diskominfo.batangkab.go.id • Pos-el: diskominfo@batangkab.go.id
            </p>
          </div>
          <img src={diskominfoLogo} alt="Logo Diskominfo" className="kopDiskominfoLogo" />
        </div>
        <div className="kopDoubleLine" />

        {/* JUDUL LAPORAN */}
        <div className="reportDocTitle">
          <h4>LAPORAN REKAPITULASI INVENTARIS ASET TEKNOLOGI INFORMASI</h4>
          <span className="docSubtitle">
            BIDANG TEKNOLOGI INFORMASI DAN KOMUNIKASI (TIK) • PER TANGGAL: {printDate.toUpperCase()}
          </span>
        </div>

        {/* STATISTIK RINGKAS DOKUMEN */}
        <div className="docSummaryRow">
          <div className="docSumBox">
            <span>Total Perangkat:</span>
            <b>{counts.total} unit</b>
          </div>
          <div className="docSumBox">
            <span>Beroperasi Normal:</span>
            <b>{counts.aktif} unit</b>
          </div>
          <div className="docSumBox">
            <span>Maintenance:</span>
            <b>{counts.maint} unit</b>
          </div>
          <div className="docSumBox">
            <span>Rusak:</span>
            <b>{counts.rusak} unit</b>
          </div>
        </div>

        {/* TABEL DATA LAPORAN */}
        <div className="tableScroll">
          <table className="officialTable">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>No</th>
                <th>Kode Aset</th>
                <th>Nama Perangkat</th>
                <th>Kategori</th>
                <th>Merk / Model</th>
                <th>Nomor Seri (S/N)</th>
                <th>IP Address</th>
                <th>Lokasi Ruangan</th>
                <th>Kondisi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => (
                <tr key={a.id}>
                  <td className="textCenter">{idx + 1}</td>
                  <td><b>{a.kodeAset}</b></td>
                  <td>{a.nama}</td>
                  <td>{a.kategori}</td>
                  <td>{[a.merk, a.model].filter(Boolean).join(' ') || '-'}</td>
                  <td><code className="snCode">{a.serialNumber || '-'}</code></td>
                  <td>{a.ipAddress || '-'}</td>
                  <td><MapsLink location={a.lokasi} latitude={a.latitude} longitude={a.longitude}>{a.lokasi || (a.latitude && a.longitude ? `${a.latitude}, ${a.longitude}` : '-')}</MapsLink></td>
                  <td className="textCenter">{a.kondisi}</td>
                  <td className="textCenter">
                    <span className={`printStatusTag ${a.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={10} className="tableEmpty">
                    Tidak ada data aset yang sesuai dengan filter laporan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PETA LOKASI ASET — DI BAWAH TABEL, SEMUA TITIK DITAMPILKAN */}
        <div className="reportMapSection noPrint">
          <div className="reportMapSectionHeader">
            <div>
              <span className="qKey">Peta Lokasi Aset</span>
              <b>Seluruh titik aset pada laporan</b>
              <small>Klik penanda pada peta untuk melihat perangkat. Tidak perlu memilih lokasi dari dropdown.</small>
            </div>
            <span className="mapAssetCount">{filtered.filter(a => a.latitude && a.longitude).length} titik lokasi</span>
          </div>
          {filtered.some(a => a.latitude && a.longitude) ? (
            <div className="reportMapContent">
              <InteractiveMap markers={filtered} />
              <div className="reportMapLegend">
                <span>Penanda dapat diklik untuk melihat detail aset.</span>
                <span>Lokasi tersimpan dari titik yang dipilih saat tambah/edit perangkat.</span>
              </div>
            </div>
          ) : (
            <div className="reportMapEmpty">Belum ada aset yang memiliki titik koordinat. Tentukan titik lokasi melalui menu Tambah atau Edit Perangkat.</div>
          )}
        </div>

        {/* TANDA TANGAN RESMI PENGESAHAN */}
        <div className="officialSignatures">
          <div className="sigColumn">
            <span>Mengetahui,</span>
            <b>Kepala Dinas Komunikasi dan Informatika</b>
            <b>Kabupaten Batang</b>
            <div className="sigSpace" />
            <span className="sigName">...................................................</span>
            <span className="sigNip">NIP. ...........................................</span>
          </div>

          <div className="sigColumn">
            <span>Batang, {printDate}</span>
            <b>Pengurus Barang Pengguna /</b>
            <b>Penatausahaan Aset TIK</b>
            <div className="sigSpace" />
            <span className="sigName">...................................................</span>
            <span className="sigNip">NIP. ...........................................</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MOUNT ROOT
// ==========================================
createRoot(document.getElementById('root')).render(<App />);
