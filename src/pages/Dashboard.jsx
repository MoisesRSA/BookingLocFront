import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, RefreshCw } from 'lucide-react';
import './Dashboard.css';

// Estes são os IDs que precisamos casar com o modelo do seu Backend (se string ou objeto).
const RESOURCES = [
  { id: 'room-a', name: 'Sala de reunião' },
  { id: 'room-b', name: 'Biblioteca' },
  { id: 'laboratory', name: 'Loboratório' },
  { id: 'court', name: 'Quadra' },
];

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 as 18:00

export default function Dashboard({ setAuth }) {
  const getTodayStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const getMaxDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const [currentDateString, setCurrentDateString] = useState(getTodayStr());
  const [isBooking, setIsBooking] = useState(false);
  const [bookingData, setBookingData] = useState({
    location: '',
    startTime: '',
    endTime: '',
    description: '' // Might be ignored by backend, but safe to send
  });

  const [apiBookings, setApiBookings] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const POLL_INTERVAL = 15000; // 15 segundos

  const handleLogout = () => {
    localStorage.removeItem("my_token");
    setAuth(false);
  };

  // Busca TODOS os agendamentos para exibir na timeline
  const fetchBookings = useCallback(async (showRefreshAnim = false) => {
    if (showRefreshAnim) setIsRefreshing(true);
    try {
      const res = await fetch("https://schedule-yi98.onrender.com/booking/timeline", {
        headers: { "Authorization": "Bearer " + localStorage.getItem("my_token") }
      });
      if (res.ok) {
        const data = await res.json();
        setApiBookings(data || []);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error("Erro ao buscar agendamentos", e);
    } finally {
      if (showRefreshAnim) setTimeout(() => setIsRefreshing(false), 600);
    }
  }, []);

  // Polling a cada 15 segundos
  useEffect(() => {
    fetchBookings(false);
    const interval = setInterval(() => fetchBookings(false), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [currentDateString, fetchBookings]);

  // Refetch quando o usuário volta para a aba
  useEffect(() => {
    const onFocus = () => fetchBookings(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchBookings]);

  // Filtra as reservas do array global que pertencem SÓ a data de "hoje"
  const getDailyBookings = () => {
    return apiBookings.filter(b => b.startTime && b.startTime.startsWith(currentDateString));
  };
  const dailyBookings = getDailyBookings();

  const handleDateChange = (val) => {
    const today = getTodayStr();
    const max = getMaxDateStr();
    if (val >= today && val <= max) {
      setCurrentDateString(val);
    }
  };

  const changeDateByDays = (days) => {
    const d = new Date(currentDateString + "T12:00:00Z");
    d.setDate(d.getDate() + days);
    handleDateChange(d.toISOString().split('T')[0]);
  };

  // Verifica se um slot já passou (somente no dia de hoje)
  const isPastSlot = (hour) => {
    const isToday = currentDateString === getTodayStr();
    if (!isToday) return false; // Datas futuras: nunca bloqueadas
    return hour < new Date().getHours(); // Hora já passou
  };

  const openBookingSlot = (locationId, hour) => {
    // Bloqueia agendamento em horários passados
    if (isPastSlot(hour)) return;

    const formattedHour = hour.toString().padStart(2, '0');
    const startObj = `${currentDateString}T${formattedHour}:00:00`;
    const endObj = `${currentDateString}T${(hour + 1).toString().padStart(2, '0')}:00:00`;

    setBookingData({
      location: locationId,
      startTime: startObj,
      endTime: endObj,
      description: ''
    });
    setIsBooking(true);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    // Validação: impede agendamento no passado (caso o usuário edite o datetime manualmente)
    const startDate = new Date(bookingData.startTime);
    if (startDate < new Date()) {
      alert('⚠️ Não é possível agendar um horário que já passou.');
      return;
    }
    // Validação: fim deve ser depois do início
    const endDate = new Date(bookingData.endTime);
    if (endDate <= startDate) {
      alert('⚠️ O horário de fim deve ser após o horário de início.');
      return;
    }

    try {
      const payloadToSend = {
          location: bookingData.location,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          status: "SCHEDULED"
      };

      const res = await fetch("https://schedule-yi98.onrender.com/booking/create", {
        method: "POST",
        headers: { 
          "Authorization": "Bearer " + localStorage.getItem("my_token"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payloadToSend)
      });

      if (res.ok) {
        alert("✅ Agendamento criado com sucesso!");
        setIsBooking(false);
        fetchBookings();
      } else {
        // Tenta ler o motivo real do erro enviado pelo backend
        const errorMsg = await res.text();
        if (errorMsg.includes("already exists") || errorMsg.includes("Booking already")) {
          alert("⚠️ Este horário já está ocupado para este local. Escolha outro horário.");
        } else {
          alert("Erro ao criar agendamento: " + (errorMsg || res.status));
        }
      }
    } catch (e) {
      alert("Falha na comunicação com o servidor Spring Boot.");
    }
  };

  return (
    <div className="dashboard-layout">
      <div className="bg-gradient-top"></div>
      <Sidebar handleLogout={handleLogout} />
      
      <main className="dashboard-main">
        <Header />
        
        <div className="dashboard-content">
          <div className="timeline-header glass-panel">
            <div className="date-navigator">
              <button className="icon-btn" onClick={() => changeDateByDays(-1)} disabled={currentDateString <= getTodayStr()}>
                <ChevronLeft size={24} />
              </button>
              <div className="date-display">
                <CalendarIcon size={20} className="primary-text" />
                <input 
                  type="date" 
                  className="date-input" 
                  value={currentDateString} 
                  min={getTodayStr()} 
                  max={getMaxDateStr()}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </div>
              <button className="icon-btn" onClick={() => changeDateByDays(1)} disabled={currentDateString >= getMaxDateStr()}>
                <ChevronRight size={24} />
              </button>
            </div>
            <div className="timeline-info">
              <div className="live-indicator">
                <span className="live-dot"></span>
                <span className="live-label">AO VIVO</span>
              </div>
              <span className="badge-info">✨ {dailyBookings.length} agendamento{dailyBookings.length !== 1 ? 's' : ''} hoje</span>
              <button
                className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                onClick={() => fetchBookings(true)}
                title="Atualizar agora"
              >
                <RefreshCw size={14} />
                {lastUpdated && (
                  <span className="last-updated">
                    {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="timeline-container glass-card">
            <div className="timeline-grid">
              
              {/* Header row: corner + resource names */}
              <div className="timeline-cell header-cell corner"></div>
              {RESOURCES.map(res => (
                <div key={res.id} className="timeline-cell header-cell resource-header">
                  {res.name}
                </div>
              ))}

              {/* Data rows: rendered per-resource with explicit grid positioning */}
              {HOURS.map((hour, rowIndex) => {
                // gridRow: +2 because row 1 is the header
                const gridRow = rowIndex + 2;

                return [
                  // Time label — always rendered
                  <div
                    key={`time-${hour}`}
                    className="timeline-cell time-label"
                    style={{ gridColumn: 1, gridRow }}
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </div>,

                  // Resource cells
                  ...RESOURCES.map((res, colIndex) => {
                    const gridColumn = colIndex + 2; // +2 because col 1 is time-label

                    const booking = dailyBookings.find(
                      b => b.location === res.id && new Date(b.startTime).getHours() === hour
                    );

                    const isCovered = dailyBookings.some(b => {
                      const startH = new Date(b.startTime).getHours();
                      const endH = new Date(b.endTime).getHours();
                      return b.location === res.id && startH < hour && endH > hour;
                    });

                    const isPast = isPastSlot(hour);

                    // Célula coberta por um agendamento multi-hora: não renderizar
                    // O booked-cell com span já ocupa esse espaço
                    if (isCovered) return null;

                    if (booking) {
                      const startH = new Date(booking.startTime).getHours();
                      const endH = new Date(booking.endTime).getHours();
                      const duration = Math.max(endH - startH, 1);

                      return (
                        <div
                          key={`${res.id}-${hour}`}
                          className="timeline-cell booked-cell"
                          style={{ gridColumn, gridRow, gridRowEnd: `span ${duration}` }}
                        >
                          <div className="booking-block glass-panel">
                            <span className="booking-status">Ocupado</span>
                            <strong className="booking-name">
                              {booking.employeeName || 'Funcionário'}
                            </strong>
                            <span className="booking-time">
                              {new Date(booking.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {new Date(booking.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // Slot vazio
                    return (
                      <div
                        key={`${res.id}-${hour}`}
                        className={`timeline-cell ${isPast ? 'past-slot' : 'empty-slot'}`}
                        style={{ gridColumn, gridRow }}
                        onClick={isPast ? undefined : () => openBookingSlot(res.id, hour)}
                        title={isPast ? 'Horário já passou' : 'Disponível! Clique para agendar'}
                      ></div>
                    );
                  })
                ];
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Modal Overlay */}
      {isBooking && (
        <div className="modal-overlay">
          <div className="glass-card booking-modal">
            <div className="modal-header">
              <h2>Confirmar Agendamento</h2>
              <button className="icon-btn" onClick={() => setIsBooking(false)}>
                <X size={24} />
              </button>
            </div>
            <form className="booking-form" onSubmit={handleBookingSubmit}>
              <div className="form-group">
                <label>Local / Recurso Selecionado</label>
                <div 
                  className="input-field" 
                  style={{ background: 'transparent', borderColor: 'transparent', padding: '4px 0', fontSize: '1.2rem', color: 'var(--primary)', fontWeight: '600' }}
                >
                  {RESOURCES.find(loc => loc.id === bookingData.location)?.name || 'Desconhecido'}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Início</label>
                  <input 
                    type="datetime-local" 
                    className="input-field" 
                    value={bookingData.startTime}
                    onChange={(e) => setBookingData({...bookingData, startTime: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Fim</label>
                  <input 
                    type="datetime-local" 
                    className="input-field" 
                    value={bookingData.endTime}
                    onChange={(e) => setBookingData({...bookingData, endTime: e.target.value})}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Motivo / Descrição</label>
                <textarea 
                  className="input-field" 
                  rows="3" 
                  value={bookingData.description}
                  onChange={(e) => setBookingData({...bookingData, description: e.target.value})}
                  placeholder="Defina brevemente a finalidade deste agendamento..." 
                ></textarea>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}>
                Concluir Agendamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
