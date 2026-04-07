import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
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

  const handleLogout = () => {
    localStorage.removeItem("my_token");
    setAuth(false);
  };

  // Buscar agendamentos reais do Java
  const fetchBookings = async () => {
    try {
      const res = await fetch("http://localhost:8081/booking/all", {
        headers: { "Authorization": "Bearer " + localStorage.getItem("my_token") }
      });
      if (res.ok) {
        const data = await res.json();
        setApiBookings(data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar API", e);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [currentDateString]);

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

  const openBookingSlot = (locationId, hour) => {
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
    try {
      const payloadToSend = {
          location: bookingData.location,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          status: "SCHEDULED"
      };

      const res = await fetch("http://localhost:8081/booking/create", {
        method: "POST",
        headers: { 
          "Authorization": "Bearer " + localStorage.getItem("my_token"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payloadToSend)
      });

      if (res.ok) {
        alert("Agendamento criado com sucesso no banco de dados!");
        setIsBooking(false);
        fetchBookings(); // Recarrega os blocos
      } else {
        alert("O Backend recusou a criação. Status do erro: " + res.status);
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
              <span className="badge-info">✨ Total agendamentos hoje: {dailyBookings.length}</span>
            </div>
          </div>

          <div className="timeline-container glass-card">
            <div className="timeline-grid">
              
              <div className="timeline-cell header-cell corner"></div>

              {RESOURCES.map(res => (
                <div key={res.id} className="timeline-cell header-cell resource-header">
                  {res.name}
                </div>
              ))}

              {HOURS.map(hour => (
                <div key={hour} className="timeline-row" style={{ display: 'contents' }}>
                  <div className="timeline-cell time-label">
                    {hour.toString().padStart(2, '0')}:00
                  </div>

                  {RESOURCES.map(res => {
                    const booking = dailyBookings.find(
                      b => b.location === res.id && new Date(b.startTime).getHours() === hour
                    );
                    
                    const isCovered = dailyBookings.some(
                      b => {
                        const startH = new Date(b.startTime).getHours();
                        const endH = new Date(b.endTime).getHours();
                        return b.location === res.id && startH < hour && endH > hour;
                      }
                    );

                    if (isCovered) {
                      return <div key={res.id + hour} className="timeline-cell covered-cell"></div>;
                    }

                    if (booking) {
                      const startH = new Date(booking.startTime).getHours();
                      const endH = new Date(booking.endTime).getHours();
                      const duration = Math.max(endH - startH, 1);

                      return (
                        <div key={res.id + hour} className="timeline-cell booked-cell" style={{ gridRowEnd: `span ${duration}` }}>
                          <div className="booking-block glass-panel">
                            <strong>Ocupado</strong>
                            <span>{booking.description || 'Reunião'}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={res.id + hour} 
                        className="timeline-cell empty-slot" 
                        onClick={() => openBookingSlot(res.id, hour)}
                        title="Disponível! Clique para agendar"
                      ></div>
                    );
                  })}
                </div>
              ))}
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
