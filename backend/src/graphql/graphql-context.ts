import type { FastifyRequest, FastifyReply } from 'fastify';
import type { DataloaderService } from './dataloaders/dataloader.service';

/** Apollo's Fastify integration passes request and reply as separate arguments. */
export function graphqlContext(
  loaders: Pick<DataloaderService, 'createLoaders'>,
) {
  return (req: FastifyRequest, res: FastifyReply) => ({
    req,
    res,
    loaders: loaders.createLoaders(),
  });
}
