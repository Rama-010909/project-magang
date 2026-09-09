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
  query,
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import pemkabLogo from './assets/pemkab-batang.png';
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
  kondisi: 'Baik',
  status: 'Aktif',
  keterangan: '',
  fotoUrl: ''
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
  Clock: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
};

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

  // Data state (Hybrid Firebase & LocalStorage)
  const [assets, setAssets] = useState(() => {
    try {
      const cached = localStorage.getItem('it_assets_list');
      return cached ? JSON.parse(cached) : INITIAL_ASSETS;
    } catch {
      return INITIAL_ASSETS;
    }
  });

  const [maint, setMaint] = useState(() => {
    try {
      const cached = localStorage.getItem('it_maint_list');
      return cached ? JSON.parse(cached) : INITIAL_MAINT;
    } catch {
      return INITIAL_MAINT;
    }
  });

  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [firebaseChecked, setFirebaseChecked] = useState(false);

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

  // Simpan ke LocalStorage sebagai backup otomatis
  useEffect(() => {
    try {
      localStorage.setItem('it_assets_list', JSON.stringify(assets));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [assets]);

  useEffect(() => {
    try {
      localStorage.setItem('it_maint_list', JSON.stringify(maint));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [maint]);

  // Inisialisasi Firebase jika env valid
  useEffect(() => {
    const hasKey = Boolean(import.meta.env.VITE_FIREBASE_API_KEY);
    if (!hasKey) {
      setIsFirebaseConnected(false);
      setFirebaseChecked(true);
      return;
    }

    try {
      const qAssets = query(collection(db, 'assets'), orderBy('createdAt', 'desc'));
      const unsubAssets = onSnapshot(
        qAssets,
        snapshot => {
          if (!snapshot.empty) {
            setAssets(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          }
          setIsFirebaseConnected(true);
          setFirebaseChecked(true);
        },
        err => {
          console.info('Firebase Firestore assets offline or restricted, fallback to local storage:', err.message);
          setIsFirebaseConnected(false);
          setFirebaseChecked(true);
        }
      );

      const qMaint = query(collection(db, 'maintenance'), orderBy('tanggal', 'desc'));
      const unsubMaint = onSnapshot(
        qMaint,
        snapshot => {
          if (!snapshot.empty) {
            setMaint(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        },
        err => {
          console.info('Firebase Firestore maint offline:', err.message);
        }
      );

      return () => {
        unsubAssets();
        unsubMaint();
      };
    } catch (e) {
      console.warn('Firebase init fallback:', e.message);
      setIsFirebaseConnected(false);
      setFirebaseChecked(true);
    }
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

  // Simpan Aset (Hybrid Firestore & Local)
  async function saveAsset(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        updatedAt: new Date().toISOString()
      };

      if (isFirebaseConnected) {
        try {
          if (editing) {
            await updateDoc(doc(db, 'assets', editing), { ...payload, updatedAt: serverTimestamp() });
          } else {
            const docRef = await addDoc(collection(db, 'assets'), {
              ...payload,
              createdAt: serverTimestamp()
            });
            payload.id = docRef.id;
          }
        } catch (err) {
          console.warn('Fallback ke local state:', err.message);
          updateLocalAssets(payload);
        }
      } else {
        updateLocalAssets(payload);
      }

      setToast(editing ? 'Data perangkat berhasil diperbarui' : 'Perangkat baru berhasil ditambahkan');
      setForm(EMPTY_FORM);
      setEditing(null);
      go('inventaris');
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateLocalAssets(payload) {
    if (editing) {
      setAssets(prev => prev.map(a => (a.id === editing ? { ...a, ...payload } : a)));
    } else {
      const newId = 'ast-' + Date.now().toString(36);
      const newRecord = { ...payload, id: newId, createdAt: new Date().toISOString() };
      setAssets(prev => [newRecord, ...prev]);
    }
  }

  // Hapus Aset
  async function removeAsset(id) {
    const target = assets.find(a => a.id === id);
    if (!confirm(`Hapus perangkat "${target?.nama || id}"? Data yang dihapus tidak dapat dikembalikan.`)) return;

    try {
      if (isFirebaseConnected) {
        try {
          await deleteDoc(doc(db, 'assets', id));
        } catch (err) {
          console.warn('Firebase delete error, removing locally:', err.message);
        }
      }
      setAssets(prev => prev.filter(a => a.id !== id));
      setMaint(prev => prev.filter(m => m.assetId !== id));
      if (selected?.id === id) setSelected(null);
      setToast('Perangkat berhasil dihapus dari inventaris');
    } catch (e) {
      alert('Gagal menghapus: ' + e.message);
    }
  }

  // Tambah Riwayat Maintenance
  async function addMaintenanceRecord(record, targetAssetId, newStatus) {
    try {
      const newMaint = {
        ...record,
        assetId: targetAssetId,
        id: 'mnt-' + Date.now().toString(36),
        createdAt: new Date().toISOString()
      };

      if (isFirebaseConnected) {
        try {
          await addDoc(collection(db, 'maintenance'), {
            ...record,
            assetId: targetAssetId,
            createdAt: serverTimestamp()
          });
          if (newStatus) {
            await updateDoc(doc(db, 'assets', targetAssetId), {
              status: newStatus,
              updatedAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.warn('Firebase maint fallback:', err.message);
        }
      }

      setMaint(prev => [newMaint, ...prev]);

      if (newStatus) {
        setAssets(prev =>
          prev.map(a => (a.id === targetAssetId ? { ...a, status: newStatus } : a))
        );
        if (selected?.id === targetAssetId) {
          setSelected(prev => (prev ? { ...prev, status: newStatus } : null));
        }
      }

      setToast('Riwayat maintenance berhasil dicatat');
    } catch (e) {
      alert('Gagal mencatat maintenance: ' + e.message);
    }
  }

  // Hapus Riwayat Maintenance
  async function removeMaintenanceRecord(id) {
    if (!confirm('Hapus riwayat maintenance ini?')) return;
    try {
      if (isFirebaseConnected) {
        try {
          await deleteDoc(doc(db, 'maintenance', id));
        } catch (e) {
          console.warn('Firebase delete error:', e.message);
        }
      }
      setMaint(prev => prev.filter(m => m.id !== id));
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
      alert('Username atau password salah! Gunakan username "admin" dan password "kominfobatang".');
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
          <div className="sidebarLogos">
            <div className="logoEmblemHolder" title="Pemerintah Kabupaten Batang">
              <img className="logoEmblem" src={pemkabLogo} alt="Lambang Kabupaten Batang" />
            </div>
            <div className="logoDiskominfoHolder" title="Dinas Komunikasi dan Informatika">
              <img className="logoDiskominfo" src={diskominfoLogo} alt="Diskominfo Batang" />
            </div>
          </div>
          <div className="sidebarBrandText">
            <span className="govSubtext">PEMKAB BATANG</span>
            <b className="appName">IT ASSET MGMT</b>
            <span className="deptSubtext">Diskominfo Kab. Batang</span>
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
          <img src={pemkabLogo} alt="Pemkab Batang" className="mobileLogo" />
          <div>
            <b className="mobileTitle">IT ASSET MANAGEMENT</b>
            <span className="mobileSubtitle">Diskominfo Kab. Batang</span>
          </div>
        </div>
        <div className="mobileActions">
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
              {page === 'form' && (editing ? 'Perbarui Data Perangkat' : 'Tambah Perangkat Baru')}
              {page === 'maintenance' && 'Riwayat & Jadwal Pemeliharaan'}
              {page === 'laporan' && 'Laporan Rekapitulasi Aset'}
            </h1>
            <p className="headerDesc">
              {page === 'dashboard' && 'Ringkasan menyeluruh kondisi infrastruktur jaringan, server, dan komputer.'}
              {page === 'inventaris' && 'Pencatatan lengkap perangkat keras, spesifikasi teknis, IP Address, dan lokasi.'}
              {page === 'form' && 'Lengkapi rincian identitas perangkat untuk inventarisasi Barang Milik Daerah (BMD).'}
              {page === 'maintenance' && 'Dokumentasi penanganan kendala teknis, perbaikan perangkat, dan hasil uji.'}
              {page === 'laporan' && 'Cetak format resmi atau ekspor tabel inventaris untuk kebutuhan audit & pembukuan.'}
            </p>
          </div>

          <div className="headerRight">
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
            pemkabLogo={pemkabLogo}
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
            <div className="loginLogoBox">
              <img src={pemkabLogo} alt="Pemkab Batang" className="loginLogoImg" />
            </div>
            <div className="loginLogoDivider" />
            <div className="loginLogoBox diskominfoBox">
              <img src={diskominfoLogo} alt="Diskominfo Batang" className="loginLogoImg" />
            </div>
          </div>

          <div className="loginBadges">
            <span className="loginGovBadge">PORTAL RESMI SPBE</span>
          </div>
          <h1 className="loginTitle">IT Asset Management</h1>
          <p className="loginSubtitle">Dinas Komunikasi dan Informatika Kabupaten Batang</p>
        </div>

        <form className="loginForm" onSubmit={onLogin}>
          <label className="inputGroup">
            <span className="inputLabel">Username Petugas</span>
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
            <span className="inputLabel">Kata Sandi (Password)</span>
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

        <div className="loginHelper">
          <p>
            Akun Default Administrator:
            <br />
            Username: <code>admin</code> • Password: <code>kominfobatang</code>
          </p>
        </div>

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
function DashboardView({ counts, assets, maint, setSelected, go, openAdd }) {
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
          <div className="govBadgeCard">
            <img src={pemkabLogo} alt="Emblem Kab. Batang" className="govCardEmblem" />
            <div className="govCardInfo">
              <b>KABUPATEN BATANG</b>
              <span>Dinas Kominfo</span>
              <span className="liveIndicator">
                <span className="liveDot" /> Sistem Aktif
              </span>
            </div>
          </div>
        </div>
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
                      <Icons.MapPin /> {a.lokasi || 'Lokasi belum diisi'}
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
                      <Icons.MapPin /> {a.lokasi || 'Belum diisi'}
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
                        <Icons.MapPin /> {a.lokasi || '-'}
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
          headers: { 'content-type': file.type },
          body: file
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) uploadedUrl = data.url;
        }
      } catch (err) {
        console.info('Endpoint /api/upload tidak tersedia di server lokal, beralih ke kompresi client:', err);
      }

      // 2. Jika /api/upload tidak menghasilkan URL (misal berjalan di localhost tanpa Vercel serverless),
      // kompres gambar menjadi base64 data URL berkualitas tinggi namun ringkas (~150KB).
      if (!uploadedUrl) {
        uploadedUrl = await compressImageToBase64(file);
      }

      setForm(prev => ({ ...prev, fotoUrl: uploadedUrl }));
    } catch (e) {
      alert('Gagal memproses gambar: ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  // Helper kompres gambar di canvas browser
  function compressImageToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 900;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('Gagal membaca gambar'));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsDataURL(file);
    });
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

          <label className="formField">
            <span className="fieldLabel">Lokasi / Ruangan Penempatan</span>
            <input
              type="text"
              placeholder="Contoh: Ruang Server Lt. 2 / Bidang IKP"
              value={form.lokasi}
              onChange={e => setForm({ ...form, lokasi: e.target.value })}
            />
          </label>

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
                    {uploading ? 'Mengompres Foto...' : 'Pilih dari File / Kamera'}
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
                      <Icons.MapPin /> {asset.lokasi || 'Belum Ditentukan'}
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
function PrintLabelModal({ asset, pemkabLogo, closeModal }) {
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
              <img src={pemkabLogo} alt="" className="labelPemkabLogo" />
              <div className="labelHeaderText">
                <b>PEMERINTAH KABUPATEN BATANG</b>
                <span>DINAS KOMUNIKASI DAN INFORMATIKA</span>
                <span className="labelSub">BARANG MILIK DAERAH (BMD)</span>
              </div>
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
                  <span>Lokasi: {asset.lokasi || 'Diskominfo'}</span>
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
                    <Icons.MapPin /> {activeAssetObj.lokasi || 'Lokasi belum ditentukan'}
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
function ReportsView({ assets, counts, pemkabLogo, diskominfoLogo }) {
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
                  <td>{a.lokasi || '-'}</td>
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
