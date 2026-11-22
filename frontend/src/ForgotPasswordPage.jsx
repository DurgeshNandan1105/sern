
import { useState } from "react";
import { Activity, Mail, ArrowLeft, ShieldCheck } from "lucide-react";

function ForgotPasswordPage({ onBack }) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Password reset request submitted!");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Activity size={30} />
          <h2>SERN</h2>
        </div>

        <h2>Forgot Password?</h2>
        <p>Enter your registered email to reset your password.</p>

        <form onSubmit={handleSubmit}>
          <label>Email Address</label>
          <div className="login-input">
            <Mail size={18} />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-submit">
            Send Reset Link
          </button>
        </form>

        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Login
        </button>

        <div className="login-security">
          <ShieldCheck size={17} />
          Secure Emergency Response Access
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
