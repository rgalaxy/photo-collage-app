import { Injectable } from '@angular/core';
import { createClient, Entry } from 'contentful';

const CONFIG = {
  space: '6sgdo00ytdl6',
  accessToken: 'PEuFx4NhbeKs2_JKfLRxRyUJ38fwnyRLEMj5I3JmwEw',
  contentType: 'blogPost',
};

@Injectable({ providedIn: 'root' })
export class BlogService {
  private client = createClient({
    space: CONFIG.space,
    accessToken: CONFIG.accessToken,
  });

  getAllPosts(): Promise<Entry<any>[]> {
    return this.client.getEntries({
      content_type: CONFIG.contentType,
      order: [`-fields.publishedAt`],
    }).then(res => res.items);
  }
}
