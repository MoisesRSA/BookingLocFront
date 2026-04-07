import { GoogleLogin } from '@react-oauth/google';
import { CalendarClock } from 'lucide-react';
import './LoginPage.css';

function LoginPage({ setAuth }) {
  const LoginSpring = async (credentialResponse) => {
    const tokenDoGoogle = credentialResponse.credential;
    try {
      const resposta = await fetch("http://localhost:8081/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleToken: tokenDoGoogle })
      });

      if (resposta.ok) {
         const tokenLocSched = await resposta.text();
         localStorage.setItem("my_token", tokenLocSched);

         // Extrai os dados visuais do token do Google (nome e foto)
         try {
           const payloadBase64 = tokenDoGoogle.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
           const payload = JSON.parse(atob(payloadBase64));
           if (payload.name) localStorage.setItem("user_name", payload.name);
           if (payload.picture) localStorage.setItem("user_picture", payload.picture);
         } catch (e) {
           console.error("Erro ao ler dados do perfil:", e);
         }

         setAuth(true);
      } else {
         console.error("Login failed with status:", resposta.status);
         alert("Backend Status: " + resposta.status);
      }
    } catch (error) {
      console.error("Network or server error during login:", error);
      alert("Backend Status: " + error);
    }
  };

  return (
    <div className="login-container">
      {/* Decorative background elements */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <div className="glass-panel login-card">
        <div className="login-header">
          <div className="logo-icon-wrapper">
            <CalendarClock size={40} color="#fff" />
          </div>
          <h1>BookingLoc</h1>
          <p className="subtitle">Gestão e agendamento inteligente de espaços.</p>
        </div>
        
        <div className="login-body">
          <h2>Entrar</h2>
          <p>Acesse seu painel para conectar e gerenciar suas reservas.</p>
          
          <div className="google-btn-wrapper">
            <GoogleLogin 
                onSuccess={LoginSpring} 
                onError={() => console.log('Ocorreu um erro no popup do Google')}
                theme="filled_black"
                size="large"
                shape="pill"
                locale="pt-BR"
                text="continue_with"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
