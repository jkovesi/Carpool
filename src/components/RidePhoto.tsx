import { useState } from "react";
import { getDestinationImageUrl } from "../utils/destinationImage";
import RideIllustration from "./RideIllustration";

interface RidePhotoProps {
  destination: string;
  className?: string;
}

// A hirdetés-kártyák / útrészletező illusztrációja: a célállomáshoz tartozó
// (kurált vagy determinisztikus tartalék) fotó a src/utils/destinationImage.ts
// segítségével — ez a helper korábban elkészült, de nem volt sehol bekötve,
// ezért futott le a régi, törött statikus placeholder kép helyette. Ha a kép
// betöltése bármiért meghiúsul, egy mindig működő SVG-illusztrációra esünk
// vissza, hogy soha ne maradjon törött kép a felületen.
export default function RidePhoto({ destination, className }: RidePhotoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <RideIllustration className={className} />;
  }

  return (
    <img
      src={getDestinationImageUrl(destination, { w: 600, h: 350 })}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
