import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Calendar as CalendarIcon, Trash2, MapPin, Clock, CalendarDays, History, AlertCircle } from 'lucide-react';
import './MyBookings.css';

const RESOURCES = [
  { id: 'room-a', name: 'Sala de reunião' },
  { id: 'room-b', name: 'Biblioteca' },
  { id: 'laboratory', name: 'Laboratório' },
  { id: 'court', name: 'Quadra' },
];

export default function MyBookings({ setAuth }) {
  const [myBookings, setMyBookings] = useState([]);

  const handleLogout = () => {
    localStorage.removeItem("my_token");
    setAuth(false);
  };

  const fetchMyBookings = async () => {
    try {
      const res = await fetch("http://localhost:8081/booking/all", {
        headers: {
           "Authorization": "Bearer " + localStorage.getItem("my_token")
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const handleCancelBooking = async (id) => {
    if (!window.confirm("Atenção! Você deseja realmente cancelar este agendamento? Esta ação não pode ser desfeita.")) return;

    try {
      const res = await fetch(`http://localhost:8081/booking/delete/${id}`, {
        method: "DELETE",
        headers: {
           "Authorization": "Bearer " + localStorage.getItem("my_token")
        }
      });
      if (res.ok) {
        // Remove locally directly to feel snappy
        setMyBookings(prev => prev.filter(b => b.id !== id));
      } else {
        alert("Erro ao cancelar o agendamento.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro de rede.");
    }
  };

  const getLocationName = (id) => {
    return RESOURCES.find(r => r.id === id)?.name || id || 'Espaço Reservado';
  };

  const formatFancyDate = (dateString) => {
    const d = new Date(dateString);
    const day = d.toLocaleDateString('pt-BR', { day: '2-digit' });
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
    return { day, month };
  };

  const formatTimeRange = (start, end) => {
    const s = new Date(start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const e = new Date(end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${s} — ${e}`;
  };

  const getFullWeekday = (dateString) => {
    const d = new Date(dateString);
    let str = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const now = new Date();
  
  // Array separations
  const upcoming = myBookings
    .filter(b => new Date(b.endTime) >= now)
    .sort((a,b) => new Date(a.startTime) - new Date(b.startTime));

  const past = myBookings
    .filter(b => new Date(b.endTime) < now)
    .sort((a,b) => new Date(b.startTime) - new Date(a.startTime));

  return (
    <div className="dashboard-layout">
      <div className="bg-gradient-top"></div>
      <Sidebar handleLogout={handleLogout} />
      
      <main className="dashboard-main">
        <Header />
        
        <div className="dashboard-content bookings-page">
          <div className="b-header-section">
            <h1 className="b-title">Meus Agendamentos</h1>
            <p className="b-subtitle">Gerencie suas reservas e acompanhe o seu histórico nos espaços da empresa.</p>
          </div>

          <section className="b-section">
            <div className="b-section-header">
              <CalendarDays className="b-section-icon highlight-icon" />
              <h2>Próximas Reservas</h2>
              <span className="b-badge">{upcoming.length} pendentes</span>
            </div>

            {upcoming.length === 0 ? (
              <div className="b-empty glass-card">
                <AlertCircle size={40} className="empty-muted-icon" />
                <h3>Tudo livre por enquanto.</h3>
                <p>Você não possui nenhum agendamento pendente no futuro.</p>
              </div>
            ) : (
              <div className="b-grid upcoming-grid">
                {upcoming.map(booking => {
                  const { day, month } = formatFancyDate(booking.startTime);
                  
                  return (
                    <div key={booking.id} className="b-card glass-card">
                      <div className="b-card-date-block">
                        <span className="month">{month}</span>
                        <span className="day">{day}</span>
                      </div>
                      
                      <div className="b-card-content">
                        <h3 className="b-location">
                          <MapPin size={18} />
                          {getLocationName(booking.location)}
                        </h3>
                        
                        <div className="b-details">
                          <span className="b-detail-item">
                            <CalendarIcon size={16} /> 
                            {getFullWeekday(booking.startTime)}
                          </span>
                          <span className="b-detail-item">
                            <Clock size={16} />
                            {formatTimeRange(booking.startTime, booking.endTime)}
                          </span>
                        </div>
                        
                        {booking.description && (
                          <div className="b-desc-box">
                            <p>{booking.description}</p>
                          </div>
                        )}
                      </div>

                      <div className="b-card-actions">
                        <button 
                          className="cancel-action-btn" 
                          onClick={() => handleCancelBooking(booking.id)}
                          title="Cancelar Agendamento"
                        >
                          <Trash2 size={20} />
                          <span>Cancelar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="b-section mt-5 past-section">
              <div className="b-section-header">
                <History className="b-section-icon muted-icon" />
                <h2>Histórico de Reservas</h2>
              </div>
              
              <div className="b-grid past-grid">
                {past.map(booking => {
                   const { day, month } = formatFancyDate(booking.startTime);
                   return (
                     <div key={booking.id} className="b-card past-card">
                       <div className="b-card-date-block muted-block">
                         <span className="month">{month}</span>
                         <span className="day">{day}</span>
                       </div>
                       
                       <div className="b-card-content">
                         <h3 className="b-location muted-location">
                           {getLocationName(booking.location)}
                         </h3>
                         
                         <div className="b-details muted-details">
                           <span className="b-detail-item">
                             {getFullWeekday(booking.startTime)} • {formatTimeRange(booking.startTime, booking.endTime)}
                           </span>
                         </div>
                       </div>
                       
                       <div className="b-past-status">
                         <span className="status-badge ended">Finalizado</span>
                       </div>
                     </div>
                   );
                })}
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
