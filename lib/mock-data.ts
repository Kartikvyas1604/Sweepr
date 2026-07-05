import type { TxLINETeam } from "@/types/txline";

const FLAG_BASE = "https://flagcdn.com/w160";

const TEAMS: TxLINETeam[] = [
  { id: "QAT", name: "Qatar", shortName: "Qatar", flagUrl: `${FLAG_BASE}/qa.png`, group: "A", fifaRanking: 50 },
  { id: "ECU", name: "Ecuador", shortName: "Ecuador", flagUrl: `${FLAG_BASE}/ec.png`, group: "A", fifaRanking: 44 },
  { id: "SEN", name: "Senegal", shortName: "Senegal", flagUrl: `${FLAG_BASE}/sn.png`, group: "A", fifaRanking: 18 },
  { id: "NED", name: "Netherlands", shortName: "Netherlands", flagUrl: `${FLAG_BASE}/nl.png`, group: "A", fifaRanking: 8 },
  { id: "ENG", name: "England", shortName: "England", flagUrl: `${FLAG_BASE}/gb-eng.png`, group: "B", fifaRanking: 5 },
  { id: "IRN", name: "Iran", shortName: "Iran", flagUrl: `${FLAG_BASE}/ir.png`, group: "B", fifaRanking: 20 },
  { id: "USA", name: "United States", shortName: "USA", flagUrl: `${FLAG_BASE}/us.png`, group: "B", fifaRanking: 16 },
  { id: "WAL", name: "Wales", shortName: "Wales", flagUrl: `${FLAG_BASE}/gb-wls.png`, group: "B", fifaRanking: 19 },
  { id: "ARG", name: "Argentina", shortName: "Argentina", flagUrl: `${FLAG_BASE}/ar.png`, group: "C", fifaRanking: 3 },
  { id: "KSA", name: "Saudi Arabia", shortName: "Saudi Arabia", flagUrl: `${FLAG_BASE}/sa.png`, group: "C", fifaRanking: 49 },
  { id: "MEX", name: "Mexico", shortName: "Mexico", flagUrl: `${FLAG_BASE}/mx.png`, group: "C", fifaRanking: 13 },
  { id: "POL", name: "Poland", shortName: "Poland", flagUrl: `${FLAG_BASE}/pl.png`, group: "C", fifaRanking: 26 },
  { id: "FRA", name: "France", shortName: "France", flagUrl: `${FLAG_BASE}/fr.png`, group: "D", fifaRanking: 4 },
  { id: "AUS", name: "Australia", shortName: "Australia", flagUrl: `${FLAG_BASE}/au.png`, group: "D", fifaRanking: 38 },
  { id: "DEN", name: "Denmark", shortName: "Denmark", flagUrl: `${FLAG_BASE}/dk.png`, group: "D", fifaRanking: 10 },
  { id: "TUN", name: "Tunisia", shortName: "Tunisia", flagUrl: `${FLAG_BASE}/tn.png`, group: "D", fifaRanking: 30 },
  { id: "ESP", name: "Spain", shortName: "Spain", flagUrl: `${FLAG_BASE}/es.png`, group: "E", fifaRanking: 7 },
  { id: "CRC", name: "Costa Rica", shortName: "Costa Rica", flagUrl: `${FLAG_BASE}/cr.png`, group: "E", fifaRanking: 31 },
  { id: "GER", name: "Germany", shortName: "Germany", flagUrl: `${FLAG_BASE}/de.png`, group: "E", fifaRanking: 11 },
  { id: "JPN", name: "Japan", shortName: "Japan", flagUrl: `${FLAG_BASE}/jp.png`, group: "E", fifaRanking: 24 },
  { id: "BEL", name: "Belgium", shortName: "Belgium", flagUrl: `${FLAG_BASE}/be.png`, group: "F", fifaRanking: 2 },
  { id: "CAN", name: "Canada", shortName: "Canada", flagUrl: `${FLAG_BASE}/ca.png`, group: "F", fifaRanking: 41 },
  { id: "MAR", name: "Morocco", shortName: "Morocco", flagUrl: `${FLAG_BASE}/ma.png`, group: "F", fifaRanking: 22 },
  { id: "CRO", name: "Croatia", shortName: "Croatia", flagUrl: `${FLAG_BASE}/hr.png`, group: "F", fifaRanking: 12 },
  { id: "BRA", name: "Brazil", shortName: "Brazil", flagUrl: `${FLAG_BASE}/br.png`, group: "G", fifaRanking: 1 },
  { id: "SRB", name: "Serbia", shortName: "Serbia", flagUrl: `${FLAG_BASE}/rs.png`, group: "G", fifaRanking: 21 },
  { id: "SUI", name: "Switzerland", shortName: "Switzerland", flagUrl: `${FLAG_BASE}/ch.png`, group: "G", fifaRanking: 15 },
  { id: "CMR", name: "Cameroon", shortName: "Cameroon", flagUrl: `${FLAG_BASE}/cm.png`, group: "G", fifaRanking: 43 },
  { id: "POR", name: "Portugal", shortName: "Portugal", flagUrl: `${FLAG_BASE}/pt.png`, group: "H", fifaRanking: 9 },
  { id: "GHA", name: "Ghana", shortName: "Ghana", flagUrl: `${FLAG_BASE}/gh.png`, group: "H", fifaRanking: 60 },
  { id: "URU", name: "Uruguay", shortName: "Uruguay", flagUrl: `${FLAG_BASE}/uy.png`, group: "H", fifaRanking: 14 },
  { id: "KOR", name: "South Korea", shortName: "South Korea", flagUrl: `${FLAG_BASE}/kr.png`, group: "H", fifaRanking: 28 },
];

export function getMockTeams(): TxLINETeam[] {
  return TEAMS;
}
