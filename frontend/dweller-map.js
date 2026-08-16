(function () {
  const CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  let loading = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS;
      document.head.appendChild(link);
      const s = document.createElement('script');
      s.src = JS;
      s.onload = () => res(window.L);
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return loading;
  }

  class DwellerMap extends HTMLElement {
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      this.style.cssText = 'display:block;position:relative;width:100%;height:100%;overflow:hidden;background:#1F1A17';

      const lat = parseFloat(this.getAttribute('lat') || '51.5545');
      const lng = parseFloat(this.getAttribute('lng') || '-0.1585');
      const label = this.getAttribute('label') || '';
      const sub = this.getAttribute('sub') || '';

      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;inset:0;filter:saturate(0.3) sepia(0.45) brightness(0.6) contrast(1.15);opacity:0;transition:opacity .6s ease';
      this.appendChild(holder);

      const veil = document.createElement('div');
      veil.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(46% 46% at 50% 50%,rgba(12,7,5,0) 30%,rgba(12,7,5,0.5) 72%,rgba(12,7,5,0.92) 100%)';
      this.appendChild(veil);

      const target = document.createElement('div');
      target.style.cssText = 'position:absolute;left:50%;top:50%;width:min(34vmin,260px);height:min(34vmin,260px);transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity .7s ease';
      target.innerHTML =
        '<div style="position:absolute;inset:0;border:1px solid rgba(240,193,115,0.3);border-radius:50%"></div>' +
        '<div style="position:absolute;inset:28%;border:1px solid rgba(240,193,115,0.5);border-radius:50%"></div>' +
        '<div style="position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#C15230;box-shadow:0 0 0 6px rgba(193,82,48,0.22),0 0 26px rgba(193,82,48,0.9)"></div>';
      this.appendChild(target);

      const cap = document.createElement('div');
      cap.style.cssText = 'position:absolute;left:0;right:0;bottom:clamp(40px,9vh,84px);text-align:center;pointer-events:none;opacity:0;transform:translateY(14px);transition:all .8s cubic-bezier(0.16,1,0.3,1);font-family:Sora,system-ui,sans-serif';
      cap.innerHTML =
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;letter-spacing:0.2em;color:#F0C173">' + label + '</div>' +
        '<div style="font-size:clamp(18px,2.4vw,26px);font-weight:400;letter-spacing:-0.025em;color:#F6F2EC;margin-top:8px">' + sub + '</div>';
      this.appendChild(cap);

      this._go = () => {
        if (this._flown) return;
        this._flown = true;
        if (!this._map) { this._pending = true; return; }
        this._map.flyTo([lat, lng], 17, { duration: 2.8, easeLinearity: 0.2 });
        setTimeout(() => {
          target.style.opacity = '1';
          cap.style.opacity = '1';
          cap.style.transform = 'none';
        }, 2100);
      };
      window.addEventListener('dweller:map-zoom', this._go);

      loadLeaflet().then((L) => {
        const map = L.map(holder, {
          center: [53.4, -2.4], zoom: 6, zoomControl: false, attributionControl: true,
          dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false,
          keyboard: false, boxZoom: false, zoomSnap: 0.1, preferCanvas: true
        });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 19, keepBuffer: 4, updateWhenZooming: false
        }).addTo(map);
        map.attributionControl.setPrefix('');
        this._map = map;
        setTimeout(() => { map.invalidateSize(); holder.style.opacity = '1'; }, 40);

        // warm the destination tiles so the final frame is sharp on arrival
        const warm = document.createElement('div');
        warm.style.cssText = 'position:absolute;width:600px;height:600px;left:-9999px;top:0';
        document.body.appendChild(warm);
        const warmMap = L.map(warm, { center: [lat, lng], zoom: 17, zoomControl: false, attributionControl: false, fadeAnimation: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(warmMap);
        setTimeout(() => { warmMap.remove(); warm.remove(); }, 9000);

        if (this._pending) { this._pending = false; this._flown = false; this._go(); }
      });
    }
    disconnectedCallback() { window.removeEventListener('dweller:map-zoom', this._go); }
  }

  if (!customElements.get('dweller-map')) customElements.define('dweller-map', DwellerMap);
})();
