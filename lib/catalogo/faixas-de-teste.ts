// As faixas da carga fictícia (supabase/seed/catalogo.sql), para os testes de frete.
// Só os testes importam este arquivo.
import type { FreteRegiao } from './tipos';

export const FAIXAS: FreteRegiao[] = [
  { nome: 'Mesma cidade e região metropolitana', cepInicio: '01000000', cepFim: '09999999', modo: 'motoboy', valorCentavos: 1500, prazoTexto: '1 a 2 dias úteis' },
  { nome: 'Retirada no ateliê', cepInicio: '01000000', cepFim: '09999999', modo: 'retirada', valorCentavos: 0, prazoTexto: 'a combinar' },
  { nome: 'Restante do estado', cepInicio: '11000000', cepFim: '19999999', modo: 'correios', valorCentavos: 2500, prazoTexto: '3 a 7 dias úteis' },
  { nome: 'Sudeste e Sul', cepInicio: '20000000', cepFim: '39999999', modo: 'correios', valorCentavos: 3000, prazoTexto: '4 a 9 dias úteis' },
  { nome: 'Demais regiões', cepInicio: '40000000', cepFim: '79999999', modo: 'correios', valorCentavos: 4000, prazoTexto: '6 a 12 dias úteis' },
  { nome: 'Sudeste e Sul', cepInicio: '80000000', cepFim: '99999999', modo: 'correios', valorCentavos: 3000, prazoTexto: '4 a 9 dias úteis' },
];
