import React from 'react';
import { User, CheckCircle2 } from 'lucide-react';
import { Card, Badge, Button, Input, Progress } from '../../components/ui/index.js';

export const ProfilePlaceholderPage = () => {
  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="blue">Profile Management</Badge>
          <span className="text-xs text-slate-400 font-mono">Candidate Profile</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
          Professional Profile
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          Manage your verified experience, technical skills, and career background.
        </p>
      </div>

      {/* Profile Completeness Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile Readiness</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete your profile to receive relevant job recommendations and match scoring.
            </p>
          </div>
          <Badge variant="warning" size="md">45% Completed</Badge>
        </div>
        <Progress value={45} size="md" variant="emerald" />
      </Card>

      {/* Form Fields Mockup */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Full Name" placeholder="Alex Morgan" disabled />
          <Input label="Email Address" placeholder="alex@example.com" disabled />
          <Input label="Professional Headline" placeholder="Senior Full-Stack Engineer" disabled />
          <Input label="Location" placeholder="San Francisco, CA or Remote" disabled />
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <Button variant="primary" size="sm" disabled>
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfilePlaceholderPage;
