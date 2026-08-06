import {
  BanknotesIcon,
  CreditCardIcon,
  DocumentCheckIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';

// Icônes mobile money (représentation visuelle, non des marques déposées)
export const OrangeMoneyIcon = ({ className = 'w-8 h-8' }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="#FF6600" />
    <path d="M12 20h4l2-6 2 10 2-6h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
export const WaveIcon = ({ className = 'w-8 h-8' }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="#0066F5" />
    <path d="M10 24c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M10 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9" />
  </svg>
);
export const YasIcon = ({ className = 'w-8 h-8' }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="#00A651" />
    <path d="M14 28V14l6 8 6-8v14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/**
 * Modes de paiement partagés entre le guichet de caisse et l'écran de
 * corrections comptables — une seule liste pour éviter deux nomenclatures
 * qui divergent avec le temps.
 */
export const MODES_PAIEMENT = [
  { value: 'especes', label: 'Espèces', Icon: BanknotesIcon, mobile: false },
  { value: 'carte', label: 'Carte bancaire', Icon: CreditCardIcon, mobile: false },
  { value: 'cheque', label: 'Chèque', Icon: DocumentCheckIcon, mobile: false },
  { value: 'virement', label: 'Virement', Icon: ArrowsRightLeftIcon, mobile: false },
  { value: 'orange_money', label: 'Orange Money', Icon: OrangeMoneyIcon, mobile: true },
  { value: 'wave', label: 'Wave', Icon: WaveIcon, mobile: true },
  { value: 'yas', label: 'Yas', Icon: YasIcon, mobile: true },
];

export const getModePaiementLabel = (value) =>
  MODES_PAIEMENT.find((m) => m.value === value)?.label || value;

export const ETAPES_MOBILE_MONEY = (nomFormate, montantFormate) => [
  `1. Ouvrez l'application ${nomFormate} sur votre téléphone.`,
  `2. Choisissez « Payer » ou « Paiement marchand ».`,
  `3. Scannez le QR code du caissier ou saisissez le code / numéro affiché.`,
  `4. Montant à payer : ${montantFormate} — vérifiez et validez.`,
  `5. Validez le paiement puis montrez l'écran de confirmation au caissier.`,
];
