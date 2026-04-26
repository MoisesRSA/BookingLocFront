import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, RefreshCw } from 'lucide-react';
import './Dashboard.css';

// Estes são os IDs que precisamos casar com o modelo do seu Backend (se string ou objeto).
const RESOURCES = [
  { id: 'room-a', name: 'Sala de Reunião' },
  { id: 'room-b', name: 'Biblioteca' },
  { id: 'laboratory', name: 'Laboratório' },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const POLL_INTERVAL = 15000; // 15 segundos

  const handleLogout = () => {
    localStorage.removeItem("my_token");
    setAuth(false);
  };

  // Normaliza uma string de data/hora para garantir parsing correto no fuso local
  // Se a string não tiver 'Z' nem offset, o JS pode interpretar como UTC em alguns navegadores
  const normalizeDateTime = (str) => {
    if (!str) return str;
    // Se já tem 'Z' ou offset (+/-HH:MM), retorna como está
    if (str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str)) return str;
    // Sem indicador de fuso: trata como horário local adicionando o offset atual
    return str; // será tratado como local pelo navegador (sem Z = local)
  };

  // Extrai a hora LOCAL de uma string de data/hora
  const getLocalHour = (dateStr) => {
    const normalized = normalizeDateTime(dateStr);
    const d = new Date(normalized);
    if (d.getSeconds() === 59) d.setSeconds(d.getSeconds() + 1); // Arredonda 10:59:59 para 11:00:00 para grid
    if (d.getSeconds() === 1) d.setSeconds(d.getSeconds() - 1); // Arredonda 10:00:01 para 10:00:00 para grid
    return d.getHours();
  };

  // Extrai apenas a parte da data (YYYY-MM-DD) no fuso local
  const getLocalDateStr = (dateStr) => {
    const normalized = normalizeDateTime(dateStr);
    const d = new Date(normalized);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  };

  // Busca TODOS os agendamentos para exibir na timeline
  const fetchBookings = useCallback(async (showRefreshAnim = false) => {
    if (showRefreshAnim) setIsRefreshing(true);
    try {
      const res = await fetch("http://localhost:8080/booking/timeline", {
        headers: { "Authorization": "Bearer " + localStorage.getItem("my_token") }
      });
      if (res.ok) {
        const data = await res.json();
        console.log("[Dashboard] Agendamentos recebidos:", data);
        setApiBookings(data || []);
        setLastUpdated(new Date());
      } else {
        const text = await res.text();
        console.error(`[Dashboard] Erro ${res.status} ao buscar agendamentos:`, text);
      }
    } catch (e) {
      console.error("[Dashboard] Erro de rede ao buscar agendamentos:", e);
    } finally {
      if (showRefreshAnim) setTimeout(() => setIsRefreshing(false), 600);
    }
  }, []);

  // Busca inicial e Conexão SSE para atualizações em tempo real
  useEffect(() => {
    fetchBookings(false);

    const token = localStorage.getItem("my_token");
    if (!token) return;

    // Conecta no endpoint de Server-Sent Events do backend
    const eventSource = new EventSource(`http://localhost:8080/booking/stream?token=${token}`);
    
    // Ouve especificamente eventos chamados "bookingUpdate"
    eventSource.addEventListener("bookingUpdate", (e) => {
      console.log("[SSE] Notificação de agendamento recebida! Atualizando grid...");
      fetchBookings(false);
    });

    eventSource.onerror = (err) => {
      console.error("[SSE] Erro de conexão.", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [fetchBookings]);

  // Refetch quando o usuário volta para a aba
  useEffect(() => {
    const onFocus = () => fetchBookings(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchBookings]);

  // Filtra as reservas do array global que pertencem SÓ à data selecionada
  // Usa getLocalDateStr para evitar problemas de fuso horário
  const getDailyBookings = () => {
    return apiBookings.filter(b => b.startTime && getLocalDateStr(b.startTime) === currentDateString);
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

    if (isSubmitting) return;
    setIsSubmitting(true);

    // Validação: impede agendamento no passado (caso o usuário edite o datetime manualmente)
    const startDate = new Date(bookingData.startTime);
    if (startDate < new Date()) {
      alert('⚠️ Não é possível agendar um horário que já passou.');
      setIsSubmitting(false);
      return;
    }
    // Validação: fim deve ser depois do início
    const endDate = new Date(bookingData.endTime);
    if (endDate <= startDate) {
      alert('⚠️ O horário de fim deve ser após o horário de início.');
      setIsSubmitting(false);
      return;
    }

    // Validação de conflito no front-end para evitar sobreposições reais
    const hasConflict = apiBookings.some(b => {
      if (b.location !== bookingData.location) return false;
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      // Conflito verdadeiro: novo inicio antes do fim existente E novo fim depois do inicio existente
      return startDate < bEnd && endDate > bStart;
    });

    if (hasConflict) {
      alert('⚠️ Este horário entra em conflito com um agendamento já existente.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Ajuste para contornar o bug do backend que acusa conflito em horários adjacentes.
      // Adicionamos 1 segundo ao início e subtraímos 1 segundo do fim.
      const pad = (n) => String(n).padStart(2, '0');
      const buildLocalISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setSeconds(adjustedStartDate.getSeconds() + 1);

      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setSeconds(adjustedEndDate.getSeconds() - 1);

      const payloadToSend = {
          location: bookingData.location,
          startTime: buildLocalISO(adjustedStartDate),
          endTime: buildLocalISO(adjustedEndDate),
          status: "SCHEDULED"
      };

      const res = await fetch("http://localhost:8080/booking/create", {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <div className="bg-gradient-top"></div>
      <Sidebar handleLogout={handleLogout} />
      
      <main className="dashboard-main">
        <Header 
          searchQuery={searchQuery} 
          onSearchChange={setSearchQuery} 
          handleLogout={handleLogout}
        />
        
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
                      b => b.location === res.id && getLocalHour(b.startTime) === hour
                    );

                    const isCovered = dailyBookings.some(b => {
                      const startH = getLocalHour(b.startTime);
                      const endH = getLocalHour(b.endTime);
                      return b.location === res.id && startH < hour && endH > hour;
                    });

                    const isPast = isPastSlot(hour);

                    // Célula coberta por um agendamento multi-hora: não renderizar
                    // O booked-cell com span já ocupa esse espaço
                    if (isCovered) return null;

                    if (booking) {
                      const startH = getLocalHour(booking.startTime);
                      const endH = getLocalHour(booking.endTime);
                      const duration = Math.max(endH - startH, 1);

                      // Lógica de pesquisa: destaca se combina, esmaece se não combina
                      const q = searchQuery.trim().toLowerCase();
                      const resourceName = res.name.toLowerCase();
                      const employeeName = (booking.employeeName || '').toLowerCase();
                      const isMatch = !q || employeeName.includes(q) || resourceName.includes(q);

                      return (
                        <div
                          key={`${res.id}-${hour}`}
                          className={`timeline-cell booked-cell ${q && !isMatch ? 'search-dimmed' : ''} ${q && isMatch ? 'search-match' : ''}`}
                          style={{ gridColumn, gridRow, gridRowEnd: `span ${duration}` }}
                        >
                          <div className="booking-block glass-panel">
                            <span className="booking-status">Ocupado</span>
                            <strong className="booking-name">
                              {booking.employeeName || 'Funcionário'}
                            </strong>
                            <span className="booking-time">
                              {(() => {
                                const startD = new Date(booking.startTime);
                                if (startD.getSeconds() === 1) startD.setSeconds(startD.getSeconds() - 1);
                                const endD = new Date(booking.endTime);
                                if (endD.getSeconds() === 59) endD.setSeconds(endD.getSeconds() + 1);
                                return `${startD.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – ${endD.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                              })()}
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

              <button type="submit" className="btn-primary" style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }} disabled={isSubmitting}>
                {isSubmitting ? 'Agendando...' : 'Concluir Agendamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
