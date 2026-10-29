// Fixed original held-out cases. Expected facts never enter model prompts.
export const heldOutCases=[
 {id:'diamond',nodes:['S','A','B','G'],edges:[['S','A'],['S','B'],['A','G'],['B','G']],directed:false,start:'S',goal:'G',order:['S','A','B','G'],path:['S','A','G']},
 {id:'directed-cycle',nodes:['S','A','B','G'],edges:[['S','A'],['A','B'],['B','S'],['B','G']],directed:true,start:'S',goal:'G',order:['S','A','B','G'],path:['S','A','B','G']},
 {id:'disconnected',nodes:['S','A','G','X'],edges:[['S','A'],['G','X']],directed:false,start:'S',goal:'G',order:['S','A','G','X'],path:null},
 {id:'start-goal',nodes:['S','A','B'],edges:[['S','A'],['A','B']],directed:false,start:'S',goal:'S',order:['S','A','B'],path:['S']},
 {id:'direction-detour',nodes:['S','A','B','G'],edges:[['A','S'],['S','B'],['B','G'],['A','G']],directed:true,start:'S',goal:'G',order:['S','A','B','G'],path:['S','B','G']},
 {id:'reversed-tie',nodes:['S','A','B','G'],edges:[['S','A'],['S','B'],['A','G'],['B','G']],directed:true,start:'S',goal:'G',order:['S','B','A','G'],path:['S','B','G']},
 {id:'shortest-branch',nodes:['S','A','B','C','G'],edges:[['S','A'],['A','B'],['B','G'],['S','C'],['C','G']],directed:false,start:'S',goal:'G',order:['S','A','B','C','G'],path:['S','C','G']},
 {id:'no-edges',nodes:['S','G'],edges:[],directed:true,start:'S',goal:'G',order:['S','G'],path:null},
 {id:'undirected-cycle',nodes:['S','A','B','G'],edges:[['S','A'],['A','B'],['B','G'],['G','S']],directed:false,start:'A',goal:'G',order:['S','A','B','G'],path:['A','S','G']},
 {id:'full-traversal',nodes:['S','A','B','X'],edges:[['S','A'],['S','B'],['A','B']],directed:false,start:'S',goal:null,order:['S','A','B','X'],path:null},
] as const;
