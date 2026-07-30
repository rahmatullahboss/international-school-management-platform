#!/usr/bin/env python3
"""Apply parser-safe canonical fixes after staging Family interaction UI."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'apps/family_app/lib/family_interaction_screens.dart'
source = path.read_text(encoding='utf-8')
old = r'''                      else
                        for (final message in interactions.messages)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.account_circle_outlined),
                            subtitle: Text(
                              _familyDateTimeLabel(context, message.sentAt),
                            ),
                            title: Text(message.authorLabel),
                            trailing: const SizedBox.shrink(),
                            isThreeLine: true,
                            dense: false,
                            visualDensity: VisualDensity.standard,
                            contentPadding: EdgeInsets.zero,
                            titleAlignment: ListTileTitleAlignment.top,
                            subtitleTextStyle:
                                Theme.of(context).textTheme.bodySmall,
                            leadingAndTrailingTextStyle:
                                Theme.of(context).textTheme.bodySmall,
                          ),
                      if (interactions.messages.isNotEmpty)
                        for (final message in interactions.messages)
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: SchoolSpacing.md,
                            ),
                            child: Text(message.body),
                          ),
'''
new = r'''                      else
                        for (final message in interactions.messages)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.account_circle_outlined),
                            subtitle: Text(
                              '${_familyDateTimeLabel(context, message.sentAt)}\n${message.body}',
                            ),
                            title: Text(message.authorLabel),
                            isThreeLine: true,
                            titleAlignment: ListTileTitleAlignment.top,
                          ),
'''
if old not in source:
    raise SystemExit('Unexpected Family conversation message block')
path.write_text(source.replace(old, new, 1), encoding='utf-8')
print('Family interaction UI canonical fixes applied.')
