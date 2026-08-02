import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Badge } from "@/frontend/components/ui/badge";
import { QRCodeSVG } from "@/frontend/components/qr-code";
import type { DoctorProfile } from "@/services/doctorService";
import { Stethoscope, Building2, MapPin, Award, Phone, Mail, CheckCircle2 } from "lucide-react";

interface DoctorProfileDialogProps {
  doctor: DoctorProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DoctorProfileDialog: React.FC<DoctorProfileDialogProps> = ({
  doctor,
  open,
  onOpenChange,
}) => {
  if (!doctor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader className="flex flex-col items-center text-center pb-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Stethoscope className="h-8 w-8" />
          </div>
          <DialogTitle className="text-xl font-bold font-display">
            Dr. {doctor.full_name}
          </DialogTitle>
          <p className="text-sm font-medium text-primary mt-0.5">{doctor.specialization}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verified Doctor
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs">
              {doctor.doctor_id}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* QR Code */}
          <div className="flex justify-center py-2">
            <QRCodeSVG value={doctor.doctor_id} size={150} />
          </div>

          {/* Details list */}
          <div className="space-y-3 rounded-xl bg-muted/40 p-4 text-sm">
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">{doctor.hospital_clinic_name}</p>
                {doctor.clinic_address && (
                  <p className="text-xs text-muted-foreground mt-0.5">{doctor.clinic_address}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Award className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">Reg. Number: </span>
                <span className="font-mono text-xs font-semibold">{doctor.registration_number}</span>
                <span className="text-xs text-muted-foreground ml-3">• {doctor.experience_years} years exp.</span>
              </div>
            </div>

            {doctor.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">{doctor.phone}</span>
              </div>
            )}

            {doctor.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">{doctor.email}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
