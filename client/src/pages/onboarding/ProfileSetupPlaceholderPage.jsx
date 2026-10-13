import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, UserCheck, ArrowLeft, LogOut, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { Button, Card, Badge } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';

export const ProfileSetupPlaceholderPage = () => {
  const navigate = useNavigate();
  const { currentUser, mongoUser, logout } = useAuth();

  const displayName =
    currentUser?.displayName ||
    mongoUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'User');
  const email = currentUser?.email || mongoUser?.email || '';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070D18] text-slate-900 dark:text-slate-100 flex flex-col relative overflow-hidden">
      {/* Subtle warm ambient lighting */}
      <div className="fixed top-12 left-1/4 w-[500px] h-[300px] bg-[#A78D78]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-[400px] h-[300px] bg-[#6E473B]/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Navigation Bar with Logout */}
      <header className="h-[72px] px-4 sm:px-8 border-b border-[#BEB5A9]/20 bg-[#1c130a]/90 backdrop-blur-xl flex items-center justify-between sticky top-0 z-30 select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6E473B] to-[#291C0E] border border-[#A78D78]/40 flex items-center justify-center text-[#f3ece1] shadow-sm">
            <Bot className="w-5 h-5 text-[#f3ece1]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-[#f3ece1] tracking-tight">
                AI Job Agent
              </span>
              <Badge variant="rose" size="sm" className="text-[11px] font-semibold">
                Onboarding
              </Badge>
            </div>
            <p className="text-xs text-[#BEB5A9] font-mono">Workspace Activation</p>
          </div>
        </div>

        {/* User info and Sign Out button */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs sm:text-[13px] font-semibold text-[#f3ece1] truncate max-w-[150px]">
              {displayName}
            </p>
            <p className="text-[11px] text-[#BEB5A9] truncate max-w-[150px]">{email}</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            leftIcon={LogOut}
            className="text-[13px] text-[#BEB5A9] hover:text-red-400 hover:bg-red-500/10"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center max-w-2xl w-full mx-auto p-4 sm:p-6 lg:p-8 my-auto">
        <div className="mb-6 text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#291C0E] border border-[#BEB5A9]/20 text-xs text-[#BEB5A9] font-mono mb-1">
            <span className="w-2 h-2 rounded-full bg-[#A78D78]" />
            <span>Step 2 of 3: Candidate Profile</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f3ece1] tracking-tight">
            Profile Setup & Verification
          </h1>

          <p className="text-xs sm:text-sm text-[#BEB5A9] max-w-md mx-auto leading-relaxed">
            Your master resume has been uploaded and stored. In the next step, our AI pipeline will extract your work experience, skills, and education.
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#6E473B]/40 border border-[#A78D78]/35 flex items-center justify-center text-[#f3ece1] shadow-md">
            <Sparkles className="w-8 h-8 text-[#f3ece1]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#f3ece1]">Resume Successfully Linked</h2>
            <p className="text-xs sm:text-sm text-[#BEB5A9] max-w-md mx-auto">
              Your document is securely saved in MongoDB and Cloudinary. The profile extraction step will be activated in the next development phase.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#291C0E]/70 border border-[#BEB5A9]/20 flex items-center justify-center gap-3 text-xs text-[#BEB5A9]">
            <CheckCircle2 className="w-4 h-4 text-[#A78D78] shrink-0" />
            <span>Master resume uploaded &bull; Vault initialized</span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/onboarding/resume')}
              leftIcon={ArrowLeft}
              className="w-full sm:w-auto text-[13px]"
            >
              Back to Resume Upload
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default ProfileSetupPlaceholderPage;
