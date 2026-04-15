import mascot from "@/assets/mascot.svg";

interface MascotAvatarProps {
  size?: number;
}

export function MascotAvatar({ size = 32 }: MascotAvatarProps) {
  return (
    <img
      src={mascot}
      alt="Olive"
      width={size}
      height={size}
      className="rounded-full"
    />
  );
}

export default MascotAvatar;
