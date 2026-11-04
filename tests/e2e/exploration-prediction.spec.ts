import { openMoreExamples } from './example-navigation';
import {test,expect} from '@playwright/test';

test('optional supported prediction uses real routes, and persists across reload',async({page})=>{
 await page.goto('/explore');await openMoreExamples(page);
  await page.getByRole('button',{name:'Try the original example',exact:true}).first().click();
 const panel=page.getByRole('region',{name:'Optional prediction'});
 await panel.getByRole('button',{name:'Predict the next node'}).click();
 await panel.getByRole('radio',{name:'Goal',exact:true}).check();
 await panel.getByLabel('Why?').fill('I expected the goal to go first.');
 await panel.getByRole('button',{name:'Check my prediction'}).click();
 await expect(panel.getByRole('status')).toContainText('This step takes a different node.');
 await expect(panel.getByRole('status')).toContainText('S leaves the front next.');
 await expect(panel).toContainText('diagram visible');
 await expect(panel.getByRole('button',{name:'Build a visual from my answer'})).toBeDisabled();
 await page.reload();await page.locator('.exploration-library button').first().click();
 await expect(panel.getByRole('status')).toContainText('You chose Goal');
 await expect(panel).toContainText('I expected the goal to go first.');
});
