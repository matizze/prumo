import { runContractSuite } from '../../contract.ts'
import { BrokenNotesRepository, MapNotesRepository, notesContract } from './notes.ts'

// O mesmo contrato contra duas implementações: a certa passa e a com defeito falha
runContractSuite(notesContract, {
  name: 'MapNotesRepository',
  create: () => new MapNotesRepository(),
})

runContractSuite(notesContract, {
  name: 'BrokenNotesRepository',
  create: () => new BrokenNotesRepository(),
})
