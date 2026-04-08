import { useState, useEffect } from 'react';
import { Bell, Search, User, X, LogOut } from 'lucide-react';
import './Header.css';

export default function Header({ searchQuery = '', onSearchChange }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Buscar os agendamentos da API para mostrar como "Lembretes" futuros
    const fetchUpcoming = async () => {
      try {
        const res = await fetch("https://schedule-yi98.onrender.com/booking/all", {
          headers: { "Authorization": "Bearer " + localStorage.getItem("my_token") }
        });
        if (res.ok) {
          const data = await res.json();
          // Filtra agendamentos do futuro e pega os 3 mais próximos
          const now = new Date();
          const upcoming = data
            .filter(b => b.startDate && new Date(b.startDate) > now)
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
            .slice(0, 3);
          
          setNotifications(upcoming);
        }
      } catch (e) {
        console.error("Notificações falharam", e);
      }
    };

    fetchUpcoming();
  }, []);

  return (
    <header className="glass-panel top-header">
      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por pessoa ou local..."
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear-btn"
            onClick={() => onSearchChange?.('')}
            title="Limpar pesquisa"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="header-actions">

        <div className="notification-container">
          <button className="icon-btn" onClick={() => setShowNotifications(!showNotifications)}>
            <Bell size={20} />
            {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
          </button>
          
          {showNotifications && (
            <div className="notification-dropdown glass-card">
              <h3 className="notif-title">Lembretes Inéditos</h3>
              {notifications.length === 0 ? (
                <p className="notif-empty">Nenhum agendamento futuro por enquanto.</p>
              ) : (
                <div className="notif-list">
                  {notifications.map(n => {
                    const dataObj = new Date(n.startDate);
                    const dataFormatada = dataObj.toLocaleDateString() + ' às ' + dataObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={n.id} className="notif-item">
                        <div className="notif-dot"></div>
                        <div className="notif-content">
                          <strong>{n.resourceId || 'Sala Reservada'}</strong>
                          <span>{dataFormatada}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="user-profile">
          <div className="avatar">
            {localStorage.getItem("user_picture") ? (
              <img 
                src={localStorage.getItem("user_picture")} 
                alt="Foto de perfil" 
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
              />
            ) : (
              <User size={20} />
            )}
          </div>
          <span className="user-name">
            {localStorage.getItem("user_name") || "Funcionário"}
          </span>
          
          <button className="header-logout-btn" onClick={handleLogout} title="Sair">
            <LogOut size={18} />
            <span className="logout-text">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}
