import { MascotAvatar } from "@/components/Chat/MascotAvatar";

export function BrandHeader() {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <MascotAvatar size={28} />
      <span className="text-lg font-bold text-text">Bazak</span>
    </div>
  );
}

export default BrandHeader;
