import { useRef, useState } from "react";
import placeholder from "../assets/ride-placeholder.jpg";
import { requestDestinationPhotoReheal } from "../lib/api";

interface RidePhotoProps {
  destination: string;
  // A ride_details nézetből érkező, célállomásonként cache-elt AI-fotó —
  // lásd KAN-39, spec 2.5/4.26. Amíg nincs "ready" állapotú, kész találat
  // (Folyamatban / Hibás / még nincs sor), a statikus ride-placeholder.jpg
  // jelenik meg helyette. Ez az AI-keresés melletti egyetlen tartalék —
  // a korábbi kurált fotólista, hash-alapú tartalékkészlet és
  // SVG-illusztráció (CURATED_BY_DESTINATION / FALLBACK_POOL /
  // RideIllustration) ennek a funkciónak nem része, kivezetésre került.
  photoUrl?: string | null;
  photoStatus?: "pending" | "ready" | "failed" | null;
  className?: string;
}

export default function RidePhoto({ destination, photoUrl, photoStatus, className }: RidePhotoProps) {
  const [broken, setBroken] = useState(false);
  const reheatRequested = useRef(false);

  const hasReadyPhoto = photoStatus === "ready" && !!photoUrl && !broken;

  if (hasReadyPhoto) {
    return (
      <img
        src={photoUrl!}
        alt=""
        loading="lazy"
        className={className}
        onError={() => {
          setBroken(true);
          // Önjavítás: a link időközben törötté vált — kérjünk egy új
          // AI-keresést ugyanarra a célállomásra (a régi linket a friss
          // találat felülírja), de csak egyszer komponensenként.
          if (!reheatRequested.current) {
            reheatRequested.current = true;
            requestDestinationPhotoReheal(destination);
          }
        }}
      />
    );
  }

  // Folyamatban / Hibás / még nincs cache-sor / törött link — statikus
  // tartalékkép, hálózati függőség nélkül, hogy soha ne maradjon törött
  // vagy hiányzó kép a felületen.
  return <img src={placeholder} alt="" className={className} />;
}
