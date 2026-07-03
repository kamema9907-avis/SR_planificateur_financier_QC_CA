import { rendementBrut, type Compte, type ProfilRendement, type TypeCompte } from '../../moteur';
import { ChampMonetaire, ChampPourcent, ChampSelect } from '../Champ';
import { formatPourcent } from '../format';

interface Props {
  comptes: readonly Compte[];
  fraisGestion: number;
  onChange: (comptes: Compte[]) => void;
  /** Types de comptes à afficher (défaut : les 6 principaux). */
  types?: readonly { type: TypeCompte; label: string }[];
}

const AVOIRS_DEFAUT: readonly { type: TypeCompte; label: string }[] = [
  { type: 'REER', label: 'REER' },
  { type: 'CELI', label: 'CELI' },
  { type: 'CELIAPP', label: 'CELIAPP' },
  { type: 'CRI', label: 'CRI / immobilisé' },
  { type: 'NON_ENREGISTRE', label: 'Non-enregistré' },
  { type: 'REEE', label: 'REEE' },
];

/** Éditeur réutilisable des comptes (solde + profil/rendement + coût de base non-enr.). */
export function EditeurComptes({ comptes, fraisGestion, onChange, types = AVOIRS_DEFAUT }: Props) {
  const compte = (type: TypeCompte) => comptes.find((c) => c.type === type);

  const majCompte = (
    type: TypeCompte,
    patch: Partial<{ solde: number; profil: ProfilRendement; coutBase: number; rendementPersonnalise: number | undefined }>,
  ) => {
    const existe = comptes.some((c) => c.type === type);
    const nouveaux = existe
      ? comptes.map((c) => (c.type === type ? { ...c, ...patch } : c))
      : [...comptes, { type, solde: 0, profil: 'equilibre' as ProfilRendement, ...patch }];
    onChange(nouveaux);
  };

  const rendementNetProfil = (p: ProfilRendement) => Math.max(0, rendementBrut(p) - fraisGestion);
  const optionsProfil: { valeur: ProfilRendement | 'personnalise'; label: string }[] = [
    { valeur: 'prudent', label: `Prudent (${formatPourcent(rendementNetProfil('prudent'))})` },
    { valeur: 'equilibre', label: `Équilibré (${formatPourcent(rendementNetProfil('equilibre'))})` },
    { valeur: 'dynamique', label: `Dynamique (${formatPourcent(rendementNetProfil('dynamique'))})` },
    { valeur: 'personnalise', label: 'Autre (personnalisé)' },
  ];

  return (
    <div className="space-y-4">
      {types.map(({ type, label }) => {
        const c = compte(type);
        const perso = c?.rendementPersonnalise != null;
        return (
          <div key={type} className="grid grid-cols-2 gap-3">
            <ChampMonetaire label={label} valeur={c?.solde ?? 0} onChange={(v) => majCompte(type, { solde: v })} />
            <ChampSelect
              label="Rendement"
              valeur={perso ? 'personnalise' : (c?.profil ?? 'equilibre')}
              options={optionsProfil}
              onChange={(v) => {
                if (v === 'personnalise') {
                  majCompte(type, { rendementPersonnalise: c?.rendementPersonnalise ?? rendementNetProfil(c?.profil ?? 'equilibre') });
                } else {
                  majCompte(type, { profil: v as ProfilRendement, rendementPersonnalise: undefined });
                }
              }}
            />
            {perso && (
              <div className="col-span-2">
                <ChampPourcent label="Rendement net annuel" valeur={c?.rendementPersonnalise ?? 0} onChange={(v) => majCompte(type, { rendementPersonnalise: v })} indice="Votre taux (frais déjà déduits)" />
              </div>
            )}
            {type === 'NON_ENREGISTRE' && (
              <div className="col-span-2">
                <ChampMonetaire label="Coût de base (non-enregistré)" valeur={c?.coutBase ?? 0} onChange={(v) => majCompte(type, { coutBase: v })} indice="Sert au calcul du gain en capital à la vente" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
