import { runContractSuite } from '../../contract.ts'
import { BrokenNotes, MapNotes, notesContract } from './notes.ts'

// O mesmo contrato contra duas implementações: a certa passa e a com defeito falha
runContractSuite(notesContract, {
  name: 'MapNotes',
  create: () => new MapNotes(),
})

runContractSuite(notesContract, {
  name: 'BrokenNotes',
  create: () => new BrokenNotes(),
})
