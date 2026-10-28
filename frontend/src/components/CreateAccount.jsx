import { AuthLayout, AuthInput } from "./ui";
import { useTranslation } from "../utils/translate";
import { useState } from "react";
import { Zap, Mail, Eye, EyeOff, User, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";
import { authErrorMessage } from "../authErrors";
import { syncUser } from "../api";

export default function CreateAccount() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const clearError = (field) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const newErrors = {};

    if (!fullName.trim()) newErrors.fullName = t("fieldRequired");
    if (!email.trim()) newErrors.email = t("fieldRequired");
    if (!password) newErrors.password = t("fieldRequired");
    if (!confirmPassword) {
      newErrors.confirmPassword = t("fieldRequired");
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t("passwordMismatch");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await updateProfile(userCredential.user, { displayName: fullName });
      await syncUser();
      navigate("/");
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        setErrors({ email: "This email is already registered" });
      } else if (error.code === "auth/weak-password") {
        setErrors({ password: "Password should be at least 6 characters" });
      } else {
        setErrors({ email: authErrorMessage(error) });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setErrors({});
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      await syncUser();
      navigate("/");
    } catch (error) {
      setErrors({ email: authErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout>
      <h1>{t("letsGetStarted")}</h1>
      <p className="auth-description">{t("signupDescription")}</p>
      <form onSubmit={handleSubmit}>
        <AuthInput
          label={t("fullName")}
          icon={User}
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            clearError("fullName");
          }}
          error={errors.fullName}
          required
        />
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
          autoComplete="new-password"
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
        <AuthInput
          label={t("confirmPassword")}
          icon={Lock}
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clearError("confirmPassword");
          }}
          error={errors.confirmPassword}
          required
          action={
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={t(
                showConfirmPassword ? "hidePassword" : "showPassword",
              )}
            >
              {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          }
        />
        <button className="button full" disabled={loading} type="submit">
          {loading ? t("creatingAccount") : t("createAccount")}
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
        {t("alreadyHaveAccount")}
        <Link to="/signin">{t("signIn")}</Link>
      </p>
    </AuthLayout>
  );
}
