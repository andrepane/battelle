export function resolveAdministrationLocation({items,areaId,subareaId}){
  const areaItems=items.filter(item=>item.area===areaId);
  const safeArea=areaItems.length?areaId:items[0]?.area??null;
  const subareas=[...new Set(items.filter(item=>item.area===safeArea).map(item=>item.subarea))];
  return {areaId:safeArea,subareaId:subareas.includes(subareaId)?subareaId:subareas[0]??null};
}

export function captureAdministrationNavigation({areaId,subareaId,trigger,scrollY=0}){
  const action=trigger?.classList?.contains('undo-previous-subarea')?'undo':'copy';
  return {areaId,subareaId,action,scrollY:Number.isFinite(scrollY)?scrollY:0};
}

export function comparisonControls(context){
  return context==='reference'
    ? {backToResults:true,changeSelection:false}
    : {backToResults:false,changeSelection:true};
}
