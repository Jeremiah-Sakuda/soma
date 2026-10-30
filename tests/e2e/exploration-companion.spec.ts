import {test,expect} from '@playwright/test';
test('native-size experiment, comparison and question remain together with reversible disclosure',async({page})=>{
 await page.setViewportSize({width:620,height:704});await page.goto('/explore');await page.getByRole('button',{name:'Compare weighted paths',exact:true}).click();await page.evaluate(()=>scrollTo(0,0));
 await expect(page.locator('.exploration-panel-graph')).toHaveCount(1);
 const composer=page.getByRole('region',{name:'Ask about your context'}),graph=page.locator('.exploration-panel-graph');
 await expect(composer).toBeInViewport({ratio:1});await expect(page.getByRole('button',{name:'Find the tipping point',exact:true})).toBeInViewport({ratio:1});
 const question=await composer.boundingBox(),drawing=await graph.boundingBox();expect(drawing!.y+drawing!.height).toBeLessThanOrEqual(question!.y);
 await page.getByRole('button',{name:/^BFS · 10/}).click();await expect(page.locator('.exploration-panel-graph')).toContainText('BFS · fewest edges');await page.getByRole('button',{name:/^Dijkstra · 3/}).click();
 await page.getByText('Select a node',{exact:true}).click();await page.getByRole('button',{name:'Node B',exact:true}).click();await expect(composer).toContainText('Asking about: B');
 await page.getByRole('button',{name:'Ask about this',exact:true}).click();await expect(page.getByRole('textbox',{name:'Where would you like to go next?'})).toBeFocused();
 await page.getByText('Change the experiment',{exact:true}).click();await page.getByRole('combobox',{name:'Goal node',exact:true}).selectOption('a');await expect(page.getByRole('combobox',{name:'Goal node',exact:true})).toHaveValue('a');
 await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:'reduce'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(composer).toBeInViewport();
});
