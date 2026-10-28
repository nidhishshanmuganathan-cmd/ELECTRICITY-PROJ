import { AuthLayout, AuthInput } from "./ui";
import { useTranslation } from "../utils/translate";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { authErrorMessage } from "../authErrors";
import { Link } from "react-router-dom";
import { Zap, Mail, Lock, Eye, EyeOff } from "lucide-react";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";

export default function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const newErrors = {};
    if (!email.trim()) newErrors.email = t("fieldRequired");
    if (!password.trim()) newErrors.password = t("fieldRequired");
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/");
    } catch (error) {
      setErrors({ password: authErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };
  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setErrors({});
    try {
      const provider = new GoogleAuthProvider();

      await signInWithPopup(auth, provider);

      navigate("/");
    } catch (error) {
      setErrors({ email: authErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrors({ email: t("enterEmailFirst") });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert(t("resetSent"));
    } catch (error) {
      setErrors({ email: authErrorMessage(error) });
    }
  };

  return (
    <AuthLayout>
      <h1>{t("welcomeBack")}</h1>
      <p className="auth-description">{t("signInToTrack")}</p>
      <form onSubmit={handleSubmit}>
        <AuthInput
          label={t("emailAddress")}
          icon={Mail}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError("email");
          }}
          error={errors.email}
          required
        />
        <AuthInput
          label={t("password")}
          icon={Lock}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError("password");
          }}
          error={errors.password}
          required
          action={
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={t(showPassword ? "hidePassword" : "showPassword")}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          }
        />
        <div className="text-right mb-4">
          <button
            type="button"
            className="button subtle"
            onClick={handleForgotPassword}
            disabled={loading}
          >
            {t("forgotPassword")}
          </button>
        </div>
        <button className="button full" disabled={loading} type="submit">
          {loading ? t("signingIn") : t("signIn")}
          <Zap size={17} />
        </button>
      </form>
      <div className="auth-divider">{t("orContinueWith")}</div>
      <button
        className="button secondary full"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <span className="google-icon" aria-hidden="true">
          G
        </span>
        {t("google")}
      </button>
      <p className="auth-bottom">
        {t("dontHaveAccount")}
        <Link to="/create-account">{t("signUp")}</Link>
      </p>
    </AuthLayout>
  );
}
