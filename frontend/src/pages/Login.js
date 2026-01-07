import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const OLL_LOGO = "https://customer-assets.emergentagent.com/job_vendormate-20/artifacts/ze7saivu_OLL-horizontal-logo-1.png";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await login(username, password);
      navigate(user.role === "oll" ? "/oll" : "/vendor");
    } catch (error) {
      // Error is handled in login function
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container" data-testid="login-page">
      <div className="login-card animate-slide-in">
        <div className="text-center">
          <img src={OLL_LOGO} alt="OLL" className="login-logo mx-auto" />
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to access the Vendor Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="username" className="form-label">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="form-input"
              required
              data-testid="username-input"
            />
          </div>

          <div>
            <Label htmlFor="password" className="form-label">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="form-input pr-10"
                required
                data-testid="password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                data-testid="toggle-password-btn"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] text-white h-11"
            disabled={isLoading}
            data-testid="login-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            Demo Credentials
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="font-medium text-slate-700">OLL Admin</p>
              <p className="text-slate-500 mt-1">olladmin / olladmin</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="font-medium text-slate-700">Vendor</p>
              <p className="text-slate-500 mt-1">vendor / vendor</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
