# Private Cat Ops Panel

Bu proje, mevcut müşteri/kedi sitesinden tamamen bağımsız, yalnızca tek sahibin kullanacağı özel rezervasyon ve muhasebe panelidir.

## İlk sürüm kapsamı

- Şifreli giriş ekranı
- Rezervasyon kayıtları
- Tahsilat takibi
- Gider kayıtları
- Aylık özet paneli
- Yaklaşan gelişler
- Açık ödeme listesi

## Durum

- Ayrı Supabase projesi kurulmuştur.
- Veritabanı tabloları ve RLS kuralları uygulanmıştır.
- `config.js` dosyası yeni Supabase projesine bağlanmıştır.

## Dosyalar

- `index.html`: Arayüz
- `styles.css`: Tasarım
- `app.js`: Panel mantığı
- `config.js`: Supabase bağlantı ayarları
- `supabase-schema.sql`: Veritabanı şeması ve güvenlik politikaları
