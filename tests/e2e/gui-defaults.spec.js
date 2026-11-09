import{test,expect}from'@playwright/test';
test('Native dialog defaults: login, password, prefixes, XML grouping and enabled states',async({page})=>{
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="logins"]').click();
 await expect(page.locator('#code-length')).toHaveValue('5');await expect(page.locator('#password-length')).toHaveValue('0');await expect(page.locator('#booklet-id')).toHaveValue('Booklet1');await expect(page.locator('#separate')).toBeChecked();
 for(const id of ['renew','monitor','prefix-testee','prefix-reserve','prefix-review','create-xml'])await expect(page.locator('#'+id)).not.toBeChecked();
 for(const id of ['code-length','password-length','monitor','prefix-testee','prefix-reserve','prefix-review','booklet-id','separate'])await expect(page.locator('#'+id)).toBeDisabled();
 await page.locator('#renew').check();await page.locator('#create-xml').check();for(const id of ['code-length','password-length','monitor','prefix-testee','prefix-reserve','prefix-review','booklet-id','separate'])await expect(page.locator('#'+id)).toBeEnabled();
});
