# Bakusam Frontend

Frontend React untuk aplikasi ojek online Bakusam dengan fitur modern dan responsive.

## Fitur Utama

- **Autentikasi**: Login/Register dengan JWT
- **Dashboard**: Dashboard berbeda untuk user dan driver
- **Booking**: Sistem pemesanan dengan peta OpenStreetMap
- **Real-time**: Tracking driver dan status booking
- **Responsive**: Desain mobile-first
- **Modern UI**: Menggunakan Tailwind CSS dan Lucide React

## Teknologi yang Digunakan

- **React 18**: Framework utama
- **React Router**: Navigasi
- **Zustand**: State management
- **Tailwind CSS**: Styling
- **Lucide React**: Icons
- **React Hook Form**: Form handling
- **React Hot Toast**: Notifications
- **Leaflet**: Maps integration
- **Axios**: HTTP client

## Struktur Proyek

```
src/
├── components/
│   ├── auth/           # Komponen autentikasi
│   ├── booking/        # Komponen booking
│   ├── common/         # Komponen umum
│   ├── dashboard/      # Dashboard components
│   ├── driver/         # Driver-specific components
│   └── profile/        # Profile components
├── stores/             # Zustand stores
├── App.js              # Main app component
├── index.js            # Entry point
└── index.css           # Global styles
```

## Setup dan Instalasi

### Prerequisites

- Node.js 16+ 
- npm atau yarn
- Backend API yang sudah running

### Instalasi

1. **Clone repository**
```bash
git clone <repository-url>
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```

Edit file `.env`:
```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Start development server**
```bash
npm start
```

Aplikasi akan berjalan di `http://localhost:3000`

## Scripts

- `npm start`: Menjalankan development server
- `npm build`: Build untuk production
- `npm test`: Menjalankan tests
- `npm eject`: Eject dari Create React App

## Komponen Utama

### Auth Components

- **Login**: Halaman login dengan validasi
- **Register**: Halaman register dengan form yang berbeda untuk user/driver

### Dashboard Components

- **Dashboard**: Layout utama dengan sidebar
- **UserDashboard**: Dashboard khusus penumpang
- **DriverDashboard**: Dashboard khusus driver dengan status online/offline

### Booking Components

- **Booking**: Halaman booking dengan peta dan form
- Integrasi OpenStreetMap untuk geocoding dan routing
- Estimasi biaya dan waktu perjalanan

### Common Components

- **LoadingSpinner**: Komponen loading yang reusable
- **ProtectedRoute**: Route protection dengan role-based access

## State Management

Menggunakan Zustand untuk state management:

- **authStore**: Autentikasi, user data, token management
- Persistent storage untuk token dan user data

## API Integration

- Axios dengan interceptors untuk JWT
- Error handling dengan toast notifications
- Automatic token refresh

## Maps Integration

- OpenStreetMap dengan Leaflet
- Geocoding menggunakan Nominatim
- Routing menggunakan OSRM
- Custom markers untuk pickup, destination, dan driver

## Styling

- Tailwind CSS untuk utility-first styling
- Custom color scheme dengan primary colors
- Responsive design dengan mobile-first approach
- Custom animations dan transitions

## Deployment

### Build untuk Production

```bash
npm run build
```

### Deploy ke VPS

1. Build aplikasi
2. Upload ke server
3. Setup Nginx untuk serve static files
4. Configure proxy untuk API calls

### Environment Variables untuk Production

```env
REACT_APP_API_URL=https://your-api-domain.com/api
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing

```bash
npm test
```

## Troubleshooting

### Common Issues

1. **CORS Error**: Pastikan backend mengizinkan origin frontend
2. **Map tidak muncul**: Check Leaflet CSS dan JS sudah loaded
3. **API calls gagal**: Verify API URL dan authentication

### Development Tips

- Gunakan React Developer Tools untuk debugging
- Check Network tab untuk API calls
- Monitor console untuk errors

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License 